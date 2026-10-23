import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { COLORS } from '@/constants/colors';
import {
  getAllAttendance,
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AdminAttendanceRecord,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getEventsByAdmin } from '@/lib/events';
import { getProfile, listUsers, type Profile, type ProfileRole } from '@/lib/profiles';

type Stat = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
};

function formatShortDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isThisMonth(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export default function Index() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<ProfileRole>('student');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  
  // Admin states
  const [adminUserCount, setAdminUserCount] = useState(0);
  const [adminEventCount, setAdminEventCount] = useState(0);
  const [adminRecords, setAdminRecords] = useState<AdminAttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!user) return;
        setLoading(true);
        const nextProfile = await getProfile(user.id);
        if (!active) return;
        setProfile(nextProfile);
        const profileRole = nextProfile?.role ?? 'student';
        setRole(profileRole);
        
        if (profileRole === 'teacher') {
          setTeacherEvents(await getTeacherEventAttendance(user.id));
        } else if (profileRole === 'administrator') {
          // Fetch system-wide data for Admin
          const [users, events, attendance] = await Promise.all([
            listUsers(),
            getEventsByAdmin(),
            getAllAttendance(),
          ]);
          if (!active) return;
          setAdminUserCount(users?.length ?? 0);
          setAdminEventCount(events?.length ?? 0);
          setAdminRecords(attendance ?? []);
        } else {
          setStudentRecords(await getAttendanceHistory(user.id));
        }
        
        if (active) setLoading(false);
      };
      void load();
      return () => {
        active = false;
      };
    }, [user]),
  );

  const pending = loading ? '—' : undefined;

  const monthlyCheckIns =
    role === 'teacher'
      ? teacherEvents.flatMap((event) => event.attendees).filter((attendee) => isThisMonth(attendee.scannedAt)).length
      : role === 'administrator'
      ? adminRecords.filter((record) => isThisMonth(record.scannedAt)).length
      : studentRecords.filter((record) => isThisMonth(record.scannedAt)).length;

  const stats: Stat[] =
    role === 'teacher'
      ? [
          {
            key: 'events',
            icon: 'event-available',
            label: 'Events created',
            value: pending ?? String(teacherEvents.length),
          },
          {
            key: 'checkins',
            icon: 'how-to-reg',
            label: 'Total check-ins',
            value:
              pending ??
              String(teacherEvents.reduce((total, event) => total + event.attendees.length, 0)),
          },
          {
            key: 'students',
            icon: 'groups',
            label: 'Students checked in',
            value:
              pending ??
              String(
                new Set(
                  teacherEvents.flatMap((event) =>
                    event.attendees.map((attendee) => attendee.studentId),
                  ),
                ).size,
              ),
          },
          {
            key: 'month',
            icon: 'date-range',
            label: 'Check-ins this month',
            value:
              pending ??
              String(
                teacherEvents
                  .flatMap((event) => event.attendees)
                  .filter((attendee) => isThisMonth(attendee.scannedAt)).length,
              ),
          },
        ]
      : role === 'administrator'
      ? [
          {
            key: 'users',
            icon: 'group',
            label: 'Total system users',
            value: pending ?? String(adminUserCount),
          },
          {
            key: 'events',
            icon: 'event',
            label: 'Total system events',
            value: pending ?? String(adminEventCount),
          },
          {
            key: 'checkins',
            icon: 'how-to-reg',
            label: 'Total check-ins',
            value: pending ?? String(adminRecords.length),
          },
        ]
      : [
          {
            key: 'checkins',
            icon: 'how-to-reg',
            label: 'Total check-ins',
            value: pending ?? String(studentRecords.length),
          },
          {
            key: 'events',
            icon: 'event',
            label: 'Events attended',
            value: pending ?? String(new Set(studentRecords.map((record) => record.eventId)).size),
          },
          {
            key: 'month',
            icon: 'date-range',
            label: 'Check-ins this month',
            value:
              pending ?? String(studentRecords.filter((record) => isThisMonth(record.scannedAt)).length),
          },
          {
            key: 'last',
            icon: 'schedule',
            label: 'Last check-in',
            value: formatShortDate(studentRecords[0]?.scannedAt),
          },
        ];

  const metadataName = user?.user_metadata?.full_name;
  const displayName =
    profile?.full_name?.trim() ||
    (typeof metadataName === 'string' ? metadataName.trim() : '') ||
    user?.email?.split('@')[0] ||
    'there';
  const greetingName = displayName.split(/\s+/)[0];
  
  const recentItems =
    role === 'teacher'
      ? teacherEvents
          .flatMap((event) =>
            event.attendees.map((attendee) => ({
              id: `${attendee.studentId}-${attendee.scannedAt}`,
              title: event.title,
              subtitle: attendee.studentName || `Student …${attendee.studentId.slice(-8)}`,
              date: attendee.scannedAt,
            })),
          )
          .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
          .slice(0, 3)
      : role === 'administrator'
      ? adminRecords.slice(0, 3).map((record) => ({
          id: record.id,
          title: record.eventTitle,
          subtitle: record.studentName || 'Unknown Student',
          date: record.scannedAt,
        }))
      : studentRecords.slice(0, 3).map((record) => ({
          id: record.id,
          title: record.eventTitle,
          subtitle: `Event ${record.eventId}`,
          date: record.scannedAt,
        }));

  const proTip = 
    role === 'administrator' ? "Monitor system activity daily to ensure everything is running smoothly." :
    role === 'teacher' ? "Remember to close your events after they end to prevent invalid check-ins." :
    "Ensure your screen brightness is up when scanning a QR code for faster detection.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, desktop && styles.desktopScrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <Text style={styles.greeting}>Hey, {greetingName}</Text>
          <Text style={styles.subtitle}>
            Welcome to QR AttendX
          </Text>
          
          <View style={styles.dashboard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>QR AttendX</Text>
              <Pressable
                accessibilityLabel="Open attendance history"
                accessibilityRole="button"
                onPress={() => router.push('/history')}
                style={({ pressed }) => [styles.cardDots, pressed && styles.quickActionPressed]}
              >
                <MaterialIcons name="apps" size={18} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View monthly attendance history"
              onPress={() => router.push('/history')}
              style={({ pressed }) => [styles.monthlyPanel, pressed && styles.featurePressed]}
            >
              <View style={styles.monthlyCopy}>
                <Text style={styles.monthlyEyebrow}>MONTHLY SUMMARY</Text>
                <Text style={styles.monthlyTitle}>Check-ins this month</Text>
                <Text style={styles.monthlyHint}>
                  {role === 'administrator' 
                    ? 'Tap to view the system history' 
                    : 'Tap to view your attendance history'}
                </Text>
              </View>
              <View
                accessibilityLabel={`${pending ?? monthlyCheckIns} check-ins this month`}
                accessibilityRole="image"
                style={styles.progressCircle}
              >
                <Svg width={88} height={88} viewBox="0 0 88 88">
                  <Circle
                    cx="44"
                    cy="44"
                    r="37"
                    fill="none"
                    stroke={COLORS.surface}
                    strokeWidth="6"
                  />
                </Svg>
                <Text style={styles.progressCount}>{pending ?? monthlyCheckIns}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={COLORS.textOnPrimary} />
            </Pressable>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTitle}>Overview</Text>
              <Text style={styles.summaryHint}>All time</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.statsScroll}
            >
              <View style={styles.statsRow}>
                {stats
                  .filter((stat) => stat.key !== 'month')
                  .slice(0, 3)
                  .map((stat) => (
                    <View key={stat.key} style={styles.statCard}>
                      <View style={styles.statCardHeader}>
                        <View style={styles.statIcon}>
                          <MaterialIcons color={COLORS.primaryDark} name={stat.icon} size={17} />
                        </View>
                        <MaterialIcons
                          name="north-east"
                          size={15}
                          color={COLORS.textSecondary}
                        />
                      </View>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text numberOfLines={2} style={styles.statLabel}>
                        {stat.label}
                      </Text>
                    </View>
                  ))}
              </View>
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.summaryTitle}>Recent check-ins</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/history')}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            </View>
            {loading ? (
              <Text style={styles.emptyActivity}>Loading activity…</Text>
            ) : recentItems.length ? (
              <View style={styles.activityList}>
                {recentItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.activityRow, index > 0 && styles.activityDivider]}
                  >
                    <View style={styles.activityIcon}>
                      <MaterialIcons
                        name={role === 'teacher' ? 'event-note' : 'check'}
                        size={17}
                        color={COLORS.primaryDark}
                      />
                    </View>
                    <View style={styles.activityCopy}>
                      <Text numberOfLines={1} style={styles.activityTitle}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.activitySubtitle}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Text style={styles.activityDate}>{formatShortDate(item.date)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyActivity}>
                {role === 'administrator' 
                  ? 'No system check-ins yet. Students will appear here once they scan.' 
                  : 'No check-ins yet. Scan an event QR to get started.'}
              </Text>
            )}

            <View style={styles.noticeCard}>
              <View style={styles.noticeIcon}>
                <MaterialIcons name="lightbulb-outline" size={20} color={COLORS.primaryDark} />
              </View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>Pro Tip</Text>
                <Text style={styles.noticeText}>{proTip}</Text>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  desktopScrollContent: { paddingHorizontal: 40, paddingTop: 40 },
  page: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingVertical: 24,
  },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSecondary,
    marginBottom: 24,
    maxWidth: 360,
  },
  dashboard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    paddingBottom: 18, 
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardDots: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  monthlyPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  featurePressed: { opacity: 0.84 },
  quickActionPressed: { opacity: 0.84 },
  monthlyCopy: {
    flex: 1,
    gap: 5,
  },
  monthlyEyebrow: {
    color: COLORS.textOnPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  monthlyTitle: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  monthlyHint: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
  },
  progressCircle: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCount: {
    position: 'absolute',
    color: COLORS.textOnPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statsScroll: {
    marginHorizontal: -18,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  statCard: {
    width: 142,
    minHeight: 124,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  viewAll: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityList: {
    marginTop: 6,
  },
  activityRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  activityDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activityIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  activitySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  activityDate: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyActivity: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 16,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
});