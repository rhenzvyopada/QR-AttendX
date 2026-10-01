import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getAttendanceHistory, getTeacherEventAttendance, type AttendanceRecord, type TeacherEventAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole>('student');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const profileRole = (await getProfile(user.id))?.role ?? 'student';
      if (!active) return;
      setRole(profileRole);
      if (profileRole === 'teacher') setTeacherEvents(await getTeacherEventAttendance(user.id));
      else setStudentRecords(await getAttendanceHistory(user.id));
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]));

  const empty = role === 'teacher' ? teacherEvents.length === 0 : studentRecords.length === 0;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}><Text style={styles.title}>{role === 'teacher' ? 'Event Attendance' : 'Attendance History'}</Text><Text style={styles.subtitle}>{role === 'teacher' ? 'Attendance for events you created.' : 'Your past attendance records.'}</Text>{loading ? <Text style={styles.center}>Loading...</Text> : empty ? <Text style={styles.center}>No attendance records yet.</Text> : role === 'teacher' ? teacherEvents.map((event) => <TeacherCard key={event.eventId} event={event} />) : studentRecords.map((record) => <StudentCard key={record.id} record={record} />)}</ScrollView>;
}

function StudentCard({ record }: { record: AttendanceRecord }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{record.eventTitle}</Text><Text style={styles.meta}>Event: {record.eventId}</Text><Text style={styles.meta}>Scanned: {new Date(record.scannedAt).toLocaleString()}</Text></View>;
}

function TeacherCard({ event }: { event: TeacherEventAttendance }) {
  return <View style={styles.card}><View style={styles.cardHeader}><View style={styles.grow}><Text style={styles.cardTitle}>{event.title}</Text><Text style={styles.meta}>{event.eventCode}</Text></View><Text style={styles.count}>{event.attendees.length}</Text></View>{event.attendees.length === 0 ? <Text style={styles.meta}>No attendees yet.</Text> : event.attendees.map((attendee) => <View key={`${attendee.studentId}-${attendee.scannedAt}`} style={styles.attendee}><Text style={styles.attendeeName}>{attendee.studentName || `Student …${attendee.studentId.slice(-8)}`}</Text><Text style={styles.meta}>{new Date(attendee.scannedAt).toLocaleString()}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  center: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 28 },
  card: { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 20, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  grow: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  count: { backgroundColor: COLORS.surface, color: COLORS.primary, fontWeight: '700', minWidth: 34, textAlign: 'center', padding: 8, borderRadius: 17 },
  attendee: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  attendeeName: { color: COLORS.textPrimary, fontWeight: '600' },
});
