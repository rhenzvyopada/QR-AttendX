import { DATABASE_SETUP_MESSAGE, isMissingTableError } from './db';
import { findEventByCode } from './events';
import { parseQRPayload } from './qr';
import { supabase } from './supabase';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  start: string | null;
  end: string | null;
  attendees: Array<{
    studentId: string;
    studentName: string | null;
    scannedAt: string;
  }>;
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

/**
 * Event-driven event bus.
 *
 * The app dispatches small, named events whenever something important happens.
 * Screens subscribe with the `useEventBus()` hook and react to the resulting
 * payloads. This makes the flow of data explicit and easy to present during a
 * demo.
 */
export type EventName =
  | 'userLogin'
  | 'userLoggedOut'
  | 'qrScan'
  | 'attendanceRecorded'
  | 'attendanceDuplicate'
  | 'attendanceInvalid'
  | 'attendanceClosed'
  | 'attendanceNotFound'
  | 'eventCreated'
  | 'eventClosed'
  | 'eventDeleted'
  | 'eventUpdated'
  | 'dataRefreshed';

export type EventBusPayload = Record<string, unknown>;

type Listener = (payload: EventBusPayload) => void;

class EventBus {
  private listeners = new Map<EventName, Set<Listener>>();

  on(name: EventName, listener: Listener): () => void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
    return () => this.off(name, listener);
  }

  off(name: EventName, listener: Listener): void {
    this.listeners.get(name)?.delete(listener);
  }

  emit(name: EventName, payload: EventBusPayload): void {
    for (const listener of this.listeners.get(name) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[EventBus] listener for ${name} threw:`, error);
      }
    }
  }
}

export const eventBus = new EventBus();

function emit(name: EventName, payload: EventBusPayload): void {
  eventBus.emit(name, payload);
}

export async function registerAttendance(
  rawPayload: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    emit('attendanceInvalid', { message: parsed.message, rawPayload });
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    emit('attendanceInvalid', { message: 'You must be signed in.', rawPayload });
    return { success: false, message: 'You must be signed in.' };
  }

  const { event, error: eventError } = await findEventByCode(payload.event);
  if (eventError && isMissingTableError(eventError)) {
    emit('attendanceInvalid', { message: DATABASE_SETUP_MESSAGE, rawPayload });
    return { success: false, message: DATABASE_SETUP_MESSAGE };
  }
  if (!event) {
    // findEventByCode reports a closed event as an error; surface it as-is so
    // the student sees exactly why the scan was rejected.
    const message =
      eventError?.message ?? 'Event not found. Ask the teacher to create a new QR code.';
    emit('attendanceInvalid', { message, rawPayload });
    return { success: false, message };
  }

  // The check-in window is validated against the event row in the database,
  // never against values embedded in the QR payload. Payload fields are
  // attacker-controlled: anyone who knows an event code could craft a QR with
  // a widened time window and forge a scan without the teacher's real code.
  const startTime = event.start_time ? new Date(event.start_time).getTime() : NaN;
  const endTime = event.end_time ? new Date(event.end_time).getTime() : NaN;
  const now = Date.now();
  if (!Number.isNaN(startTime) && now < startTime) {
    emit('attendanceInvalid', { message: 'Event has not started yet.', rawPayload });
    return { success: false, message: 'Event has not started yet.' };
  }
  if (!Number.isNaN(endTime) && now > endTime) {
    emit('attendanceClosed', { eventId: event.id, eventTitle: event.title });
    return { success: false, message: 'Event has already ended.' };
  }

  const { error } = await supabase.from('attendance').insert({
    student_id: authData.user.id,
    event_id: event.id,
  });

  if (error?.code === '23505') {
    emit('attendanceDuplicate', { eventId: event.id, eventTitle: event.title });
    return { success: false, message: 'Already registered for this event.' };
  }
  if (error && isMissingTableError(error)) {
    emit('attendanceInvalid', { message: DATABASE_SETUP_MESSAGE, rawPayload });
    return { success: false, message: DATABASE_SETUP_MESSAGE };
  }
  if (error) {
    emit('attendanceInvalid', { message: 'Could not record attendance.', rawPayload });
    return { success: false, message: 'Could not record attendance.' };
  }

  emit('attendanceRecorded', {
    studentId: authData.user.id,
    eventId: event.id,
    eventTitle: event.title,
  });

  return { success: true, message: 'Attendance recorded!', eventTitle: event.title };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, event_id, events ( title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });
  if (error) return [];

  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: Array.isArray(row.events) ? row.events[0]?.title : row.events?.title,
    scannedAt: row.scanned_at,
  }));
}

/**
 * Core loader for event + attendee data. When `teacherId` is provided only that
 * teacher's events are returned; otherwise every event in the system is
 * returned (the latter is restricted to administrators by RLS).
 */
async function loadEventAttendance(teacherId?: string): Promise<TeacherEventAttendance[]> {
  let query = supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .order('created_at', { ascending: false });
  if (teacherId) query = query.eq('created_by', teacherId);
  const { data: events, error: eventsError } = await query;
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });
  if (attendanceError) return [];

  const studentIds = [...new Set((attendance ?? []).map((row) => row.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    attendees: (attendance ?? [])
      .filter((row) => row.event_id === event.id)
      .map((row) => ({
        studentId: row.student_id,
        studentName: names.get(row.student_id) ?? null,
        scannedAt: row.scanned_at,
      })),
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  return loadEventAttendance(teacherId);
}

/**
 * Returns every event in the system together with its attendee list, so an
 * administrator can review all events and the overall history in one place.
 * Only administrators may read this (enforced by RLS); anyone else receives an
 * empty list.
 */
export async function getAllEventAttendance(): Promise<TeacherEventAttendance[]> {
  return loadEventAttendance();
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: rows, error } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);
  if (error) return [];

  const counts: Record<string, number> = {};
  (rows ?? []).forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}

export type AdminAttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string | null;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  scannedAt: string;
};

/**
 * Returns every attendance record across the system with student names and
 * event titles resolved, so an administrator can review the full log. Only
 * administrators are permitted to read this (enforced by RLS); a non-admin
 * receives an empty list.
 */
export async function getAllAttendance(): Promise<AdminAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, student_id, event_id, scanned_at')
    .order('scanned_at', { ascending: false });
  if (error) return [];

  const rows = data ?? [];
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  const eventIds = [...new Set(rows.map((row) => row.event_id))];

  const [profilesResult, eventsResult] = await Promise.all([
    studentIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string }> }),
    eventIds.length
      ? supabase.from('events').select('id, title, event_code').in('id', eventIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; event_code: string }> }),
  ]);

  const names = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name ?? profile.email])
  );
  const eventMap = new Map((eventsResult.data ?? []).map((event) => [event.id, event]));

  return rows.map((row) => {
    const event = eventMap.get(row.event_id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: names.get(row.student_id) ?? null,
      eventId: row.event_id,
      eventTitle: event?.title ?? 'Unknown event',
      eventCode: event?.event_code ?? '',
      scannedAt: row.scanned_at,
    };
  });
}
