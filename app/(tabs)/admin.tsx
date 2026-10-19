import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { createElement, useCallback, useState, type ChangeEvent } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import EmptyState from '@/components/EmptyState';
import Gate from '@/components/Gate';
import PickerField from '@/components/PickerField';
import TextField from '@/components/TextField';
import { COLORS } from '@/constants/colors';
import { getAllAttendance, type AdminAttendanceRecord } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import {
  closeEvent,
  deleteEvent,
  getEventsByAdmin,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import {
  listUsers,
  setAttendance,
  setUserRole,
  type Profile,
  type ProfileRole,
} from '@/lib/profiles';

type Tab = 'users' | 'events' | 'attendance' | 'reports';

const isAndroid = Platform.OS === 'android';
const isWeb = Platform.OS === 'web';

const ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'administrator', label: 'Administrator' },
];

const TABS: { key: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'users', label: 'Users', icon: 'group' },
  { key: 'events', label: 'Events', icon: 'event' },
  { key: 'attendance', label: 'Attendance', icon: 'how-to-reg' },
  { key: 'reports', label: 'Reports', icon: 'assessment' },
];

const pad = (value: number) => String(value).padStart(2, '0');

function toLocalISO(date: Date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatTimestamp(value: string) {
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

function toWebPickerValue(date: Date, mode: 'date' | 'time') {
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RoleSelector({ value, onChange }: { value: ProfileRole; onChange: (role: ProfileRole) => void }) {
  return (
    <View style={styles.roles}>
      {ROLE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.value)}
            style={[styles.roleOption, active && styles.activeRole]}
          >
            <Text style={[styles.roleText, active && styles.activeRoleText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        danger && styles.actionButtonDanger,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <MaterialIcons color={danger ? COLORS.danger : COLORS.primaryInk} name={icon} size={16} />
      <Text style={[styles.actionButtonText, danger && styles.actionButtonTextDanger]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Reusable date + time picker field. Renders two pressable fields (date, time)
 * that open a native DateTimePicker, or an inline <input> on web. Encapsulates
 * all picker state so it can be dropped into the event editor and the
 * attendance "fix time" row without duplicating logic.
 */
function DateTimeField({
  value,
  onChange,
  label,
}: {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
}) {
  const [editTarget, setEditTarget] = useState<'date' | 'time' | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(value);

  const openPicker = (part: 'date' | 'time') => {
    setPickerDraft(new Date(value));
    setEditTarget(part);
  };

  const applyPickerValue = (selected: Date) => {
    if (!editTarget) return;
    const updated =
      editTarget === 'date'
        ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), value.getHours(), value.getMinutes())
        : new Date(value.getFullYear(), value.getMonth(), value.getDate(), selected.getHours(), selected.getMinutes());
    onChange(updated);
  };

  const onPickerChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      if (isAndroid) setEditTarget(null);
      return;
    }
    if (isAndroid) {
      applyPickerValue(selected);
      setEditTarget(null);
    } else {
      setPickerDraft(selected);
    }
  };

  const onWebPickerChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editTarget || !event.currentTarget.value) return;
    const updated = new Date(pickerDraft);
    if (editTarget === 'date') {
      const [year, month, day] = event.currentTarget.value.split('-').map(Number);
      updated.setFullYear(year, month - 1, day);
    } else {
      const [hours, minutes] = event.currentTarget.value.split(':').map(Number);
      updated.setHours(hours, minutes, 0, 0);
    }
    setPickerDraft(updated);
  };

  const confirmPicker = () => {
    applyPickerValue(pickerDraft);
    setEditTarget(null);
  };

  return (
    <View>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeColumn}>
          <PickerField
            value={formatDate(value)}
            icon="date-range"
            label={`${label} date`}
            onPress={() => openPicker('date')}
          />
        </View>
        <View style={styles.dateTimeColumn}>
          <PickerField
            value={formatTime(value)}
            icon="schedule"
            label={`${label} time`}
            onPress={() => openPicker('time')}
          />
        </View>
      </View>

      {editTarget && isAndroid && (
        <DateTimePicker
          value={value}
          mode={editTarget}
          display={editTarget === 'time' ? 'clock' : 'calendar'}
          is24Hour={false}
          onChange={onPickerChange}
        />
      )}

      {!isAndroid && editTarget && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setEditTarget(null)}>
          <View style={styles.modalScrim}>
            <View accessibilityViewIsModal style={styles.pickerSheet}>
              <Text style={styles.pickerSheetTitle}>Choose {label} {editTarget}</Text>
              <Text style={styles.pickerSheetValue}>
                {editTarget === 'date' ? formatDate(pickerDraft) : formatTime(pickerDraft)}
              </Text>
              {isWeb
                ? createElement('input', {
                    'aria-label': `Choose ${label} ${editTarget}`,
                    type: editTarget,
                    value: toWebPickerValue(pickerDraft, editTarget),
                    onChange: onWebPickerChange,
                    style: {
                      width: '100%',
                      minHeight: 48,
                      boxSizing: 'border-box',
                      border: '1px solid ' + COLORS.border,
                      borderRadius: 14,
                      backgroundColor: COLORS.card,
                      color: COLORS.textPrimary,
                      fontFamily: 'inherit',
                      fontSize: 16,
                      padding: '10px 14px',
                    },
                  })
                : (
                    <DateTimePicker
                      value={pickerDraft}
                      mode={editTarget}
                      display={editTarget === 'time' ? 'spinner' : 'inline'}
                      is24Hour={false}
                      textColor={COLORS.textPrimary}
                      themeVariant="light"
                      accentColor={COLORS.primary}
                      onChange={onPickerChange}
                      style={styles.iosPicker}
                    />
                  )}
              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditTarget(null)}
                  style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed]}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmPicker}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]}
                >
                  <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function UserRow({ user, onChanged }: { user: Profile; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<ProfileRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRole() {
    setSaving(true);
    setError(null);
    const { error: saveError } = await setUserRole(user.id, role);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.full_name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}</Text>
        </View>
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={styles.name}>{user.full_name ?? user.email}</Text>
          <Text numberOfLines={1} style={styles.email}>{user.email}</Text>
        </View>
        <View style={[styles.statusPill, styles.statusPillOpen]}>
          <Text style={styles.statusPillText}>{user.role}</Text>
        </View>
      </View>

      {editing ? (
        <View style={styles.inlineEditor}>
          <Text style={styles.pickerLabel}>Assign role</Text>
          <RoleSelector value={role} onChange={setRole} />
          <View style={styles.rowActions}>
            <ActionButton icon="check" label="Save" onPress={saveRole} disabled={saving} />
            <ActionButton icon="close" label="Cancel" onPress={() => setEditing(false)} disabled={saving} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      ) : (
        <View style={styles.cardActions}>
          <ActionButton icon="edit" label="Change role" onPress={() => setEditing(true)} disabled={saving} />
        </View>
      )}
    </View>
  );
}

function EventRow({
  event,
  checkIns,
  onChanged,
}: {
  event: CloudEvent;
  checkIns: number;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [venue, setVenue] = useState(event.venue ?? '');
  const [description, setDescription] = useState(event.description ?? '');
  const [startDate, setStartDate] = useState(() => new Date(event.start_time ?? Date.now()));
  const [endDate, setEndDate] = useState(
    () => new Date(event.end_time ?? (event.start_time ? new Date(event.start_time).getTime() + 3600000 : Date.now() + 3600000))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = event.status === 'closed';

  async function saveEdits() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setError('End time must be after the start time.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: saveError } = await updateEvent(event.id, {
      title: title.trim(),
      venue: venue.trim() || null,
      description: description.trim() || null,
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function toggleStatus() {
    setSaving(true);
    setError(null);
    const { error: toggleError } = await closeEvent(event.id, closed ? 'reopen' : 'close');
    setSaving(false);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    onChanged();
  }

  async function remove() {
    setSaving(true);
    setError(null);
    const { error: deleteError } = await deleteEvent(event.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <MaterialIcons color={COLORS.primaryInk} name="event" size={20} />
        </View>
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={styles.name}>{event.title}</Text>
          <Text numberOfLines={1} style={styles.email}>{event.event_code}</Text>
          {event.venue ? (
            <Text numberOfLines={1} style={styles.meta}>📍 {event.venue}</Text>
          ) : null}
          <Text numberOfLines={1} style={styles.meta}>
            {event.start_time ? formatTimestamp(event.start_time) : 'No date set'}
            {event.end_time ? ` → ${formatTime(new Date(event.end_time))}` : ''}
          </Text>
        </View>
        <View style={styles.eventPills}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {checkIns} {checkIns === 1 ? 'check-in' : 'check-ins'}
            </Text>
          </View>
          <View style={[styles.statusPill, closed ? styles.statusPillClosed : styles.statusPillOpen]}>
            <Text style={[styles.statusPillText, closed && styles.statusPillTextClosed]}>
              {event.status ?? 'open'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ActionButton icon="edit" label="Edit" onPress={() => setEditing((value) => !value)} disabled={saving} />
        <ActionButton
          icon={closed ? 'restore' : 'lock'}
          label={closed ? 'Reopen' : 'Close'}
          onPress={toggleStatus}
          disabled={saving}
        />
        <ActionButton icon="delete" label="Delete" tone="danger" onPress={remove} disabled={saving} />
      </View>

      {editing && (
        <View style={styles.inlineEditor}>
          <TextField label="Event title" onChangeText={setTitle} placeholder="Event title" value={title} />
          <TextField label="Venue" onChangeText={setVenue} placeholder="Venue" value={venue} />
          <TextField label="Description" onChangeText={setDescription} placeholder="Description" value={description} />
          <DateTimeField label="Start" value={startDate} onChange={setStartDate} />
          <DateTimeField label="End" value={endDate} onChange={setEndDate} />
          <View style={styles.rowActions}>
            <ActionButton icon="check" label="Save changes" onPress={saveEdits} disabled={saving} />
            <ActionButton icon="close" label="Cancel" onPress={() => setEditing(false)} disabled={saving} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

function AttendanceRow({ record, onChanged }: { record: AdminAttendanceRecord; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [scannedAt, setScannedAt] = useState(() => new Date(record.scannedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveFix() {
    setSaving(true);
    setError(null);
    // setAttendance upserts by (student_id, event_id); passing a corrected
    // timestamp updates the existing record.
    const { error: saveError } = await setAttendance(record.studentId, record.eventId, toLocalISO(scannedAt));
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setSaving(true);
    setError(null);
    // Passing null removes the attendance record.
    const { error: deleteError } = await setAttendance(record.studentId, record.eventId, null);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <MaterialIcons color={COLORS.primaryInk} name="how-to-reg" size={20} />
        </View>
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={styles.name}>{record.studentName ?? 'Unknown student'}</Text>
          <Text numberOfLines={1} style={styles.email}>
            {record.eventTitle}
            {record.eventCode ? ` · ${record.eventCode}` : ''}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>🕘 {formatTimestamp(record.scannedAt)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ActionButton icon="edit" label="Fix time" onPress={() => setEditing((value) => !value)} disabled={saving} />
        <ActionButton icon="delete" label="Remove" tone="danger" onPress={remove} disabled={saving} />
      </View>

      {editing && (
        <View style={styles.inlineEditor}>
          <DateTimeField label="Scanned at" value={scannedAt} onChange={setScannedAt} />
          <View style={styles.rowActions}>
            <ActionButton icon="check" label="Save time" onPress={saveFix} disabled={saving} />
            <ActionButton icon="close" label="Cancel" onPress={() => setEditing(false)} disabled={saving} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialIcons color={COLORS.primaryInk} name={icon} size={18} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [userList, eventList, attendanceList] = await Promise.all([
      listUsers(),
      getEventsByAdmin(),
      getAllAttendance(),
    ]);
    setUsers(userList ?? []);
    setEvents(eventList ?? []);
    setAttendance(attendanceList ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const studentCount = users.filter((item) => item.role === 'student').length;
  const teacherCount = users.filter((item) => item.role === 'teacher').length;
  const adminCount = users.filter((item) => item.role === 'administrator').length;
  const openEvents = events.filter((item) => item.status !== 'closed').length;
  const closedEvents = events.length - openEvents;
  const uniqueStudents = new Set(attendance.map((item) => item.studentId)).size;

  const perEvent = events
    .map((event) => ({
      id: event.id,
      title: event.title,
      eventCode: event.event_code,
      count: attendance.filter((item) => item.eventId === event.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const topStudents = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    attendance.forEach((item) => {
      const name = item.studentName ?? 'Unknown student';
      const entry = counts.get(item.studentId) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(item.studentId, entry);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  })();

  // Live counts shown as badges on the section tabs.
  const tabCount = (key: Tab): number | null =>
    key === 'users'
      ? users.length
      : key === 'events'
        ? events.length
        : key === 'attendance'
          ? attendance.length
          : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Gate>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialIcons color={COLORS.textOnPrimary} name="admin-panel-settings" size={26} />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerEyebrow}>ADMIN CONSOLE</Text>
            <Text style={styles.bannerTitle}>Administrator</Text>
            <Text style={styles.bannerSubtitle}>
              View every event, review the overall check-in history, and manage accounts.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh data"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            hitSlop={6}
            onPress={() => void load()}
            style={({ pressed }) => [
              styles.bannerRefresh,
              pressed && styles.bannerRefreshPressed,
              loading && styles.bannerRefreshDisabled,
            ]}
          >
            <MaterialIcons color={COLORS.textOnPrimary} name="refresh" size={20} />
          </Pressable>
        </View>

        <View style={styles.bannerStats}>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatValue}>{loading ? '—' : users.length}</Text>
            <Text style={styles.bannerStatLabel}>Users</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatValue}>{loading ? '—' : events.length}</Text>
            <Text style={styles.bannerStatLabel}>Events</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatValue}>{loading ? '—' : attendance.length}</Text>
            <Text style={styles.bannerStatLabel}>Check-ins</Text>
          </View>
        </View>

        <View style={styles.tabbar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count = tabCount(tab.key);
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <MaterialIcons
                  color={active ? COLORS.textOnPrimary : COLORS.textSecondary}
                  name={tab.icon}
                  size={16}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                {count !== null && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.loadingText}>Loading system data…</Text>
          </View>
        ) : (
          <>
            {activeTab === 'users' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionTitle}>User accounts</Text>
                    <Text style={styles.sectionHint}>
                      Everyone registered in the system — change roles as needed.
                    </Text>
                  </View>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{users.length}</Text>
                  </View>
                </View>
                {users.length === 0 ? (
                  <EmptyState icon="group" title="No users found" subtitle="Register a new account from the sign-up screen." />
                ) : (
                  users.map((item) => <UserRow key={item.id} user={item} onChanged={load} />)
                )}
              </View>
            )}

            {activeTab === 'events' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionTitle}>All events</Text>
                    <Text style={styles.sectionHint}>
                      Every event across the system — open or closed — with its check-in count.
                    </Text>
                  </View>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{events.length}</Text>
                  </View>
                </View>
                {events.length === 0 ? (
                  <EmptyState
                    icon="event"
                    title="No events yet"
                    subtitle="Events created by teachers will appear here for you to review."
                  />
                ) : (
                  events.map((item) => (
                    <EventRow
                      key={item.id}
                      event={item}
                      checkIns={attendance.filter((entry) => entry.eventId === item.id).length}
                      onChanged={load}
                    />
                  ))
                )}
              </View>
            )}

            {activeTab === 'attendance' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionTitle}>Attendance records</Text>
                    <Text style={styles.sectionHint}>
                      The overall check-in history for every event, newest first.
                    </Text>
                  </View>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{attendance.length}</Text>
                  </View>
                </View>
                {attendance.length === 0 ? (
                  <EmptyState icon="check-circle" title="No attendance recorded" subtitle="Students check in with their QR codes to build up these records." />
                ) : (
                  attendance.map((item) => <AttendanceRow key={item.id} record={item} onChanged={load} />)
                )}
              </View>
            )}

            {activeTab === 'reports' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionTitle}>System overview</Text>
                    <Text style={styles.sectionHint}>
                      Live counts and rankings across the whole system.
                    </Text>
                  </View>
                </View>
                <View style={styles.statGrid}>
                  <StatCard icon="group" label="Total users" value={String(users.length)} />
                  <StatCard icon="school" label="Students" value={String(studentCount)} />
                  <StatCard icon="person" label="Teachers" value={String(teacherCount)} />
                  <StatCard icon="security" label="Admins" value={String(adminCount)} />
                  <StatCard icon="event" label="Events" value={String(events.length)} />
                  <StatCard icon="lock-open" label="Open events" value={String(openEvents)} />
                  <StatCard icon="lock" label="Closed events" value={String(closedEvents)} />
                  <StatCard icon="how-to-reg" label="Check-ins" value={String(attendance.length)} />
                  <StatCard icon="groups" label="Students attended" value={String(uniqueStudents)} />
                </View>

                <Text style={[styles.sectionTitle, styles.subHeading]}>Attendance by event</Text>
                {perEvent.length === 0 ? (
                  <Text style={styles.emptyText}>No events to report on yet.</Text>
                ) : (
                  perEvent.map((item) => (
                    <View key={item.id} style={styles.reportRow}>
                      <View style={styles.rowText}>
                        <Text numberOfLines={1} style={styles.name}>{item.title}</Text>
                        <Text style={styles.email}>{item.eventCode}</Text>
                      </View>
                      <View style={styles.countPill}>
                        <Text style={styles.countPillText}>{item.count}</Text>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[styles.sectionTitle, styles.subHeading]}>Most active students</Text>
                {topStudents.length === 0 ? (
                  <Text style={styles.emptyText}>No check-ins recorded yet.</Text>
                ) : (
                  topStudents.map((item, index) => (
                    <View key={`${item.name}-${index}`} style={styles.reportRow}>
                      <View style={styles.rowText}>
                        <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                      </View>
                      <View style={styles.countPill}>
                        <Text style={styles.countPillText}>{item.count}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </Gate>
    </ScrollView>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerEyebrow: {
    color: COLORS.onPrimaryMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: { color: COLORS.textOnPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  bannerSubtitle: { color: COLORS.onPrimaryMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  bannerRefresh: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerRefreshPressed: { opacity: 0.6 },
  bannerRefreshDisabled: { opacity: 0.5 },
  bannerStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  bannerStat: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  bannerStatValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  bannerStatLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  tabbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.textOnPrimary, fontWeight: '800' },
  tabBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary },
  tabBadgeTextActive: { color: COLORS.textOnPrimary },
  loadingState: { paddingVertical: 40, alignItems: 'center', gap: 10, backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  section: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionHeadingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  sectionHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 17 },
  sectionCount: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  subHeading: { marginTop: 24, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  eventPills: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusPillOpen: { backgroundColor: COLORS.successLight },
  statusPillClosed: { backgroundColor: '#F6E2E2' },
  statusPillText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark, textTransform: 'capitalize' },
  statusPillTextClosed: { color: '#B33A3A' },
  rowText: { flexShrink: 1, minWidth: 0 },
  rowActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primaryInk },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  email: { fontSize: 12, color: COLORS.textSecondary },
  meta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  roles: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  activeRole: { backgroundColor: COLORS.accent, borderColor: COLORS.primary },
  activeRoleText: { color: COLORS.primaryDark, fontWeight: '800' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  actionButtonDanger: { borderColor: COLORS.danger },
  actionButtonPressed: { backgroundColor: COLORS.surface, borderColor: COLORS.primary },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  actionButtonTextDanger: { color: COLORS.danger },
  inlineEditor: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    gap: 4,
  },
  error: { color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: 6 },
  pickerLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  dateTimeRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateTimeColumn: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
  modalScrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: 20,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  pickerSheetTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', textTransform: 'capitalize' },
  pickerSheetValue: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  iosPicker: { width: '100%' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalButton: {
    minWidth: 96,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalButtonPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalButtonPressed: { opacity: 0.7 },
  modalButtonText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  modalButtonPrimaryText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: 130,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  countPill: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
  },
  countPillText: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 },
});
