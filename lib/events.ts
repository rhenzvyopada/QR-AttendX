import type { PostgrestError } from '@supabase/supabase-js';

import { DATABASE_SETUP_MESSAGE, isMissingTableError } from './db';
import { ensureProfile } from './profiles';
import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  venue?: string | null;
  description?: string | null;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  venue?: string | null;
  description?: string | null;
  start_time: string | null;
  end_time: string | null;
  status?: 'open' | 'closed';
  closed_at?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export async function createEvent(event: Event) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  // The "Users can insert events" policy requires a teacher profile row for the
  // current user. Recreate it from auth metadata if it is missing.
  await ensureProfile(authData.user.id);

  const { data, error } = await supabase
    .from('events')
    .upsert(
      {
        event_code: event.eventId,
        title: event.title,
        venue: event.venue ?? null,
        description: event.description ?? null,
        start_time: event.start,
        end_time: event.end,
        created_by: authData.user.id,
      },
      { onConflict: 'event_code' }
    )
    .select('*')
    .single();

  if (error && isMissingTableError(error)) {
    return { data: null, error: new Error(DATABASE_SETUP_MESSAGE) };
  }

  return { data, error };
}

export async function getEventsByTeacher(teacherId: string): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getEventsByAdmin(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getEventById(eventId: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error && !isMissingTableError(error)) return null;
  return (data ?? null) as CloudEvent | null;
}

export async function updateEvent(
  eventId: string,
  updates: { title?: string; venue?: string | null; description?: string | null; start?: string; end?: string }
): Promise<{ data: CloudEvent | null; error: Error | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  const event = await getEventById(eventId);
  if (!event) return { data: null, error: new Error('Event not found.') };

  // Owner (teacher) or administrator may edit. Admin can edit anyone's; a teacher
  // may only edit their own events.
  if (event.created_by !== authData.user.id) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .eq('role', 'administrator')
      .maybeSingle();
    if (!adminCheck?.id) {
      return { data: null, error: new Error('You can only edit events you created.') };
    }
  }

  // Map the friendly field names onto the actual database columns.
  const columns: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) columns.title = updates.title;
  if (updates.venue !== undefined) columns.venue = updates.venue;
  if (updates.description !== undefined) columns.description = updates.description;
  if (updates.start !== undefined) columns.start_time = updates.start;
  if (updates.end !== undefined) columns.end_time = updates.end;

  const { data, error } = await supabase
    .from('events')
    .update(columns)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error && !isMissingTableError(error)) return { data: null, error: error };
  return { data: data as CloudEvent, error: null };
}

export async function closeEvent(
  eventId: string,
  action: 'close' | 'reopen'
): Promise<{ data: CloudEvent | null; error: Error | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('id, created_by, status')
    .eq('id', eventId)
    .maybeSingle();
  if (fetchError || !event) return { data: null, error: new Error('Event not found.') };

  // Owner or administrator may change status.
  if (event.created_by !== authData.user.id) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .eq('role', 'administrator')
      .maybeSingle();
    if (!adminCheck?.id) {
      return { data: null, error: new Error('You can only manage events you created.') };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .update({
      status: action === 'close' ? 'closed' : 'open',
      closed_at: action === 'close' ? now : null,
    })
    .eq('id', eventId)
    .select('*')
    .single();

  if (error && !isMissingTableError(error)) return { data: null, error: error };
  return { data: data as CloudEvent, error: null };
}

export async function deleteEvent(eventId: string): Promise<{ error: Error | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { error: authError ?? new Error('You must be signed in.') };
  }

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('id, created_by')
    .eq('id', eventId)
    .maybeSingle();
  if (fetchError || !event) return { error: new Error('Event not found.') };

  // Owner (teacher) or administrator may delete.
  if (event.created_by !== authData.user.id) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .eq('role', 'administrator')
      .maybeSingle();
    if (!adminCheck?.id) {
      return { error: new Error('You can only delete events you created.') };
    }
  }

  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error && !isMissingTableError(error)) return { error };
  return { error: null };
}

export async function findEventByCode(
  code: string
): Promise<{ event: CloudEvent | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error && !isMissingTableError(error)) return { event: null, error: error };
  const event = data ?? null;
  if (!event) return { event: null, error: null };

  // A closed event is no longer valid for scanning; students cannot register.
  if (event.status === 'closed') {
    return { event: null, error: new Error('This event is closed.') };
  }

  return { event: event as CloudEvent, error: null };
}
