import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import PageHeader from '@/components/PageHeader';
import { COLORS } from '@/constants/colors';
import {
  getAllAttendance,
  getAllEventAttendance,
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AdminAttendanceRecord,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole>('student');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [adminEvents, setAdminEvents] = useState<TeacherEventAttendance[]>([]);
  const [adminLog, setAdminLog] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const profileRole = (await getProfile(user.id))?.role ?? 'student';
      if (!active) return;
      setRole(profileRole);
      if (profileRole === 'teacher') {
        setTeacherEvents(await getTeacherEventAttendance(user.id));
      } else if (profileRole === 'administrator') {
        // Administrators see every event plus the full system-wide check-in log.
        const [events, log] = await Promise.all([
          getAllEventAttendance(),
          getAllAttendance(),
        ]);
        if (!active) return;
        setAdminEvents(events);
        setAdminLog(log);
      } else {
        setStudentRecords(await getAttendanceHistory(user.id));
      }
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]));

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'administrator';
  const empty = isAdmin
    ? adminEvents.length === 0 && adminLog.length === 0
    : isTeacher
      ? teacherEvents.length === 0
      : studentRecords.length === 0;
  const checkInCount = isAdmin
    ? adminLog.length
    : isTeacher
      ? teacherEvents.reduce((total, event) => total + event.attendees.length, 0)
      : studentRecords.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="Activity"
        title={
          isAdmin ? 'SYSTEM HISTORY' : isTeacher ? 'EVENT ATTENDANCE' : 'ATTENDANCE HISTORY'
        }
        subtitle={
          isAdmin
            ? 'Every event and check-in recorded across the whole app.'
            : isTeacher
              ? 'Attendance for events you created.'
              : ''
        }
      />

      {!loading && !empty && (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow}>
                {isAdmin
                  ? 'SYSTEM OVERVIEW'
                  : isTeacher
                    ? 'TOTAL CHECK-INS'
                    : 'ATTENDANCE OVERVIEW'}
              </Text>
              <Text style={styles.summaryValue}>{checkInCount}</Text>
              <Text style={styles.summaryHint}>
                {isAdmin
                  ? `Across ${adminEvents.length} ${adminEvents.length === 1 ? 'event' : 'events'} · ${new Set(adminLog.map((record) => record.studentId)).size} students`
                  : isTeacher
                    ? `Across ${teacherEvents.length} ${teacherEvents.length === 1 ? 'event' : 'events'}`
                    : `${new Set(studentRecords.map((record) => record.eventId)).size} events attended`}
              </Text>
            </View>
            <View style={styles.summaryIcon}>
              <MaterialIcons
                color={COLORS.primaryDark}
                name={isAdmin ? 'shield' : isTeacher ? 'event-available' : 'how-to-reg'}
                size={23}
              />
            </View>
          </View>
          {!isAdmin && (
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>{isTeacher ? 'Your events' : 'Recent check-ins'}</Text>
              <Text style={styles.listCount}>
                {isTeacher ? teacherEvents.length : studentRecords.length}
              </Text>
            </View>
          )}
        </>
      )}

      {loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.stateHint}>Loading attendance records…</Text>
        </View>
      ) : empty ? (
        <View style={styles.emptyCard}>
          <View style={styles.stateIcon}>
            <MaterialIcons color={COLORS.primary} name="history" size={28} />
          </View>
          <Text style={styles.stateTitle}>
            {isAdmin ? 'No activity recorded yet.' : 'No attendance records yet.'}
          </Text>
          <Text style={styles.stateHint}>
            {isAdmin
              ? 'Events created by teachers and their check-ins will appear here.'
              : isTeacher
                ? 'Create an event in the Teacher tab and check-ins will appear here.'
                : 'Scan an event QR code and your check-ins will show up here.'}
          </Text>
        </View>
      ) : isAdmin ? (
        <>
          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>All events</Text>
            <Text style={styles.listCount}>{adminEvents.length}</Text>
          </View>
          {adminEvents.length === 0 ? (
            <Text style={styles.sectionEmpty}>No events have been created yet.</Text>
          ) : (
            adminEvents.map((event) => <EventCard key={event.eventId} event={event} />)
          )}

          <View style={[styles.listHeading, styles.historyHeading]}>
            <Text style={styles.listTitle}>Overall check-in history</Text>
            <Text style={styles.listCount}>{adminLog.length}</Text>
          </View>
          {adminLog.length === 0 ? (
            <Text style={styles.sectionEmpty}>No check-ins recorded yet.</Text>
          ) : (
            adminLog.map((record) => <LogCard key={record.id} record={record} />)
          )}
        </>
      ) : isTeacher ? (
        teacherEvents.map((event) => <EventCard key={event.eventId} event={event} />)
      ) : (
        studentRecords.map((record) => <StudentCard key={record.id} record={record} />)
      )}
    </ScrollView>
  );
}

function StudentCard({ record }: { record: AttendanceRecord }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <MaterialIcons color={COLORS.primary} name="how-to-reg" size={22} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.cardTitle}>{record.eventTitle}</Text>
          <Text style={styles.meta}>Event: {record.eventId}</Text>
        </View>
        <View style={styles.badge}>
          <MaterialIcons color={COLORS.primary} name="check-circle" size={13} />
          <Text style={styles.badgeText}>Checked in</Text>
        </View>
      </View>
      <View style={styles.timeRow}>
        <MaterialIcons color={COLORS.textSecondary} name="schedule" size={14} />
        <Text style={styles.timeText}>{formatTimestamp(record.scannedAt)}</Text>
      </View>
    </View>
  );
}

function EventCard({ event }: { event: TeacherEventAttendance }) {
  const count = event.attendees.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <MaterialIcons color={COLORS.primary} name="event" size={22} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.cardTitle}>{event.title}</Text>
          <Text style={styles.meta}>{event.eventCode}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {count} {count === 1 ? 'check-in' : 'check-ins'}
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <Text style={styles.emptyNote}>No attendees yet.</Text>
      ) : (
        <View style={styles.attendeeList}>
          {event.attendees.map((attendee, index) => {
            const name = attendee.studentName || `Student …${attendee.studentId.slice(-8)}`;
            const initial = name.trim().charAt(0).toUpperCase();
            return (
              <View
                key={`${attendee.studentId}-${attendee.scannedAt}`}
                style={[styles.attendee, index > 0 && styles.attendeeDivider]}
              >
                <View style={styles.attendeeAvatar}>
                  <Text style={styles.attendeeInitial}>{initial}</Text>
                </View>
                <View style={styles.grow}>
                  <Text style={styles.attendeeName}>{name}</Text>
                  <Text style={styles.meta}>{formatTimestamp(attendee.scannedAt)}</Text>
                </View>
                <MaterialIcons color={COLORS.success} name="check-circle" size={16} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** One row of the system-wide check-in log shown to administrators. */
function LogCard({ record }: { record: AdminAttendanceRecord }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <MaterialIcons color={COLORS.primary} name="person" size={22} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.cardTitle}>{record.studentName ?? 'Unknown student'}</Text>
          <Text style={styles.meta}>
            {record.eventTitle}
            {record.eventCode ? ` · ${record.eventCode}` : ''}
          </Text>
        </View>
        <View style={styles.badge}>
          <MaterialIcons color={COLORS.primary} name="check-circle" size={13} />
          <Text style={styles.badgeText}>Checked in</Text>
        </View>
      </View>
      <View style={styles.timeRow}>
        <MaterialIcons color={COLORS.textSecondary} name="schedule" size={14} />
        <Text style={styles.timeText}>{formatTimestamp(record.scannedAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 24,
  },
  summaryCopy: { flex: 1, gap: 3 },
  summaryEyebrow: {
    color: COLORS.textOnPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  summaryValue: {
    color: COLORS.textOnPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryHint: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '600' },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textOnPrimary,
    borderWidth: 1,
    borderColor: COLORS.textOnPrimary,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  listCount: {
    minWidth: 28,
    overflow: 'hidden',
    textAlign: 'center',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  historyHeading: { marginTop: 26 },
  sectionEmpty: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
  },
  stateBlock: { alignItems: 'center', gap: 10, paddingVertical: 44, paddingHorizontal: 16 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  stateHint: { fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 420 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grow: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  timeText: { fontSize: 13, color: COLORS.textSecondary },
  countPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  countPillText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  emptyNote: { fontSize: 13, color: COLORS.textSecondary, marginTop: 14, marginLeft: 54 },
  attendeeList: { marginTop: 14 },
  attendee: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  attendeeDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  attendeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendeeInitial: { fontSize: 14, fontWeight: '800', color: COLORS.primaryInk },
  attendeeName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
});
