import { MaterialIcons } from '@expo/vector-icons';
import { createElement, useCallback, useState, type ChangeEvent } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import PageHeader from '@/components/PageHeader';
import PickerField from '@/components/PickerField';
import PressableChip from '@/components/PressableChip';
import TextField from '@/components/TextField';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  createEvent,
  closeEvent,
  deleteEvent,
  getEventsByTeacher,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import { getProfile, type ProfileRole } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';
import { eventBus } from '@/lib/attendance';

const isAndroid = Platform.OS === 'android';
const isWeb = Platform.OS === 'web';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function toWebPickerValue(date: Date, mode: 'date' | 'time') {
  const pad = (value: number) => String(value).padStart(2, '0');
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimestampShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<'start' | 'end' | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [pickerDraft, setPickerDraft] = useState(() => new Date());
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [viewingEvent, setViewingEvent] = useState<CloudEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    id: string;
    event_code: string;
    title: string;
    venue: string | null;
    description: string | null;
    start: string;
    end: string;
  } | null>(null);

  const loadEvents = useCallback(() => {
    if (user) getEventsByTeacher(user.id).then((list) => setEvents(list));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) getProfile(user.id).then((profile) => active && setRole(profile?.role ?? 'student'));
      if (user) getEventsByTeacher(user.id).then((list) => active && setEvents(list));
      return () => {
        active = false;
      };
    }, [user]),
  );

  const openPicker = (target: 'start' | 'end', part: 'date' | 'time') => {
    setPickerDraft(new Date(target === 'start' ? startDate : endDate));
    setEditTarget(target);
    setEditingPart(part);
  };

  const applyPickerValue = (selected: Date) => {
    if (!editTarget) return;
    const current = editTarget === 'start' ? startDate : endDate;
    const updated = editingPart === 'date'
      ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), current.getHours(), current.getMinutes())
      : new Date(current.getFullYear(), current.getMonth(), current.getDate(), selected.getHours(), selected.getMinutes());
    if (editTarget === 'start') setStartDate(updated);
    else setEndDate(updated);
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
    if (editingPart === 'date') {
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

  const setEndOffset = (minutes: number) => {
    setEndDate(new Date(startDate.getTime() + minutes * 60 * 1000));
  };

  const handleCreateEvent = async () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      venue: venue.trim() || null,
      description: description.trim() || null,
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('Start time must be before end time.');
      return;
    }

    const { error } = await createEvent(event);
    if (error) {
      setMessage(error.message);
      setPayload(null);
      return;
    }
    setMessage('Event saved! Students can now scan this QR code.');
    setPayload(buildQRPayload(event));
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setEditingEvent(null);
    loadEvents();
    eventBus.emit('eventCreated', { eventId, title: event.title, start: event.start, end: event.end, status: 'open' });
  };

  const startEditing = (event: CloudEvent) => {
    setEditingEvent({
      id: event.id,
      event_code: event.event_code,
      title: event.title,
      venue: event.venue ?? null,
      description: event.description ?? null,
      start: toLocalISO(new Date(event.start_time ?? Date.now())),
      end: toLocalISO(new Date(event.end_time ?? Date.now() + 3600000)),
    });
  };

  const handleEditEvent = async () => {
    if (!editingEvent) return;
    const { error } = await updateEvent(editingEvent.id, {
      title: editingEvent.title,
      venue: editingEvent.venue,
      description: editingEvent.description,
      start: editingEvent.start,
      end: editingEvent.end,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Event updated.');
    setEditingEvent(null);
    loadEvents();
    eventBus.emit('eventUpdated', { eventId: editingEvent.id, title: editingEvent.title, start: editingEvent.start, end: editingEvent.end });
  };

  const handleCloseEvent = async (action: 'close' | 'reopen') => {
    if (!editingEvent) return;
    const { error } = await closeEvent(editingEvent.id, action);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Event ' + (action === 'close' ? 'closed' : 'reopened') + '.');
    setEditingEvent(null);
    loadEvents();
    eventBus.emit('eventClosed', { eventId: editingEvent.id, status: action === 'close' ? 'closed' : 'open', action });
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    const { error } = await deleteEvent(editingEvent.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Event deleted.');
    setEditingEvent(null);
    loadEvents();
    eventBus.emit('eventDeleted', { eventId: editingEvent.id });
  };

  if (!role) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color='#231e27' size='large' />
        <Text style={styles.gateTitle}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.gate}>
        <View style={styles.gateIcon}>
          <MaterialIcons color='#231e27' name='lock' size={28} />
        </View>
        <Text style={styles.gateTitle}>Teachers Only</Text>
        <Text style={styles.gateSubtitle}>
          Event creation is available to teacher accounts.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps='handled'
    >
      <View style={styles.formCard}>
        <PageHeader
          eyebrow='Teacher tools'
          title='Create event QR'
          subtitle='Fill in the event details, then scan the generated QR with the Scan tab.'
        />

        <TextField
          label='Event Title'
          onChangeText={setTitle}
          placeholder='e.g. Founders Day Assembly'
          value={title}
        />
        <TextField
          autoCapitalize='characters'
          label='Event Code'
          onChangeText={setEventId}
          placeholder='e.g. EVT-2026-0002'
          value={eventId}
        />
        <TextField
          label='Venue'
          onChangeText={setVenue}
          placeholder='e.g. School Gymnasium'
          value={venue}
        />
        <TextField
          label='Description'
          onChangeText={setDescription}
          placeholder='What is this event about?'
          value={description}
        />

        <Text style={styles.label}>Start</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeColumn}>
            <Text style={styles.pickerLabel}>Date</Text>
            <PickerField
              value={formatDate(startDate)}
              icon='date-range'
              label='Choose start date'
              onPress={() => openPicker('start', 'date')}
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <Text style={styles.pickerLabel}>Time</Text>
            <PickerField
              value={formatTime(startDate)}
              icon='schedule'
              label='Choose start time'
              onPress={() => openPicker('start', 'time')}
            />
          </View>
        </View>

        <Text style={styles.label}>Ends</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeColumn}>
            <Text style={styles.pickerLabel}>Date</Text>
            <PickerField
              value={formatDate(endDate)}
              icon='date-range'
              label='Choose end date'
              onPress={() => openPicker('end', 'date')}
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <Text style={styles.pickerLabel}>Time</Text>
            <PickerField
              value={formatTime(endDate)}
              icon='schedule'
              label='Choose end time'
              onPress={() => openPicker('end', 'time')}
            />
          </View>
        </View>

        <View style={styles.chipRow}>
          <Text style={styles.chipLabel}>Quick add:</Text>
          <PressableChip label='+30 min' onPress={() => setEndOffset(30)} />
          <PressableChip label='+1 hour' onPress={() => setEndOffset(60)} />
          <PressableChip label='+2 hours' onPress={() => setEndOffset(120)} />
        </View>

        {editTarget && isAndroid && (
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={editingPart}
            display={editingPart === 'time' ? 'clock' : 'calendar'}
            is24Hour={false}
            onChange={onPickerChange}
          />
        )}

        {!isAndroid && (
          <Modal
            animationType='fade'
            transparent
            visible={!!editTarget}
            onRequestClose={() => setEditTarget(null)}
          >
            <View style={styles.modalScrim}>
              <View accessibilityViewIsModal style={styles.pickerSheet}>
                <Text style={styles.pickerSheetTitle}>
                  Choose {editTarget} {editingPart}
                </Text>
                <Text style={styles.pickerSheetValue}>
                  {editingPart === 'date' ? formatDate(pickerDraft) : formatTime(pickerDraft)}
                </Text>
                {isWeb ? createElement('input', {
                  'aria-label': `Choose ${editTarget} ${editingPart}`,
                  type: editingPart,
                  value: toWebPickerValue(pickerDraft, editingPart),
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
                }) : (
                  <DateTimePicker
                    value={pickerDraft}
                    mode={editingPart}
                    display={editingPart === 'date' ? 'inline' : 'spinner'}
                    is24Hour={false}
                    textColor={COLORS.textPrimary}
                    themeVariant='light'
                    accentColor={COLORS.primary}
                    onChange={onPickerChange}
                    style={styles.iosPicker}
                  />
                )}
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole='button'
                    onPress={() => setEditTarget(null)}
                    style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed]}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole='button'
                    onPress={confirmPicker}
                    style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]}
                  >
                    <Text style={styles.modalButtonText}>Confirm</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>

      {editingEvent && (
        <View style={styles.formCard}>
          <Text style={styles.label}>Editing Event · {editingEvent.event_code}</Text>
          <TextField
            label='Event Title'
            onChangeText={(title) => setEditingEvent({ ...editingEvent, title })}
            placeholder='Event title'
            value={editingEvent.title}
          />
          <TextField
            label='Venue'
            onChangeText={(value) => setEditingEvent({ ...editingEvent, venue: value })}
            placeholder='Venue'
            value={editingEvent.venue ?? ''}
          />
          <TextField
            label='Description'
            onChangeText={(value) => setEditingEvent({ ...editingEvent, description: value })}
            placeholder='Description'
            value={editingEvent.description ?? ''}
          />
          <View style={styles.row}>
            <AppButton icon='save' theme='primary' onPress={handleEditEvent} title='Save changes' />
            <AppButton icon='lock' theme='secondary' onPress={() => handleCloseEvent('close')} title='Close' />
            <AppButton icon='restore' theme='secondary' onPress={() => handleCloseEvent('reopen')} title='Reopen' />
            <AppButton icon='delete' theme='secondary' onPress={handleDeleteEvent} title='Delete' />
          </View>
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.label}>My events ({events.length})</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No events yet. Create one above to get started.</Text>
        ) : (
          events.map((event) => {
            const closed = event.status === 'closed';
            return (
              <View key={event.id} style={styles.eventListItem}>
                <View style={styles.eventListCopy}>
                  <Text numberOfLines={1} style={styles.eventListTitle}>{event.title}</Text>
                  <Text style={styles.eventListMeta}>
                    {event.event_code}
                    {event.venue ? ` · ${event.venue}` : ''}
                  </Text>
                  <Text style={styles.eventListMeta}>
                    {event.start_time ? formatTimestampShort(event.start_time) : 'No date'}
                  </Text>
                </View>
                <Text style={[styles.eventListStatus, closed && styles.eventListStatusClosed]}>
                  {event.status ?? 'open'}
                </Text>
                <View style={styles.eventListActions}>
                  <AppButton icon='visibility' theme='secondary' onPress={() => setViewingEvent(event)} title='View' />
                  <AppButton icon='edit' theme='secondary' onPress={() => startEditing(event)} title='Edit' />
                  <AppButton
                    icon={closed ? 'restore' : 'lock'}
                    theme='secondary'
                    onPress={async () => {
                      await closeEvent(event.id, closed ? 'reopen' : 'close');
                      loadEvents();
                    }}
                    title={closed ? 'Reopen' : 'Close'}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      {viewingEvent && (
        <Modal animationType='fade' transparent visible onRequestClose={() => setViewingEvent(null)}>
          <View style={styles.modalScrim}>
            <View accessibilityViewIsModal style={styles.pickerSheet}>
              <Text style={styles.pickerSheetTitle}>{viewingEvent.title}</Text>
              <Text style={styles.pickerSheetValue}>{viewingEvent.event_code}</Text>
              <View style={styles.detailList}>
                <DetailRow label='Venue' value={viewingEvent.venue || 'Not specified'} />
                <DetailRow label='Description' value={viewingEvent.description || 'No description'} />
                <DetailRow label='Starts' value={viewingEvent.start_time ? formatTimestampShort(viewingEvent.start_time) : '—'} />
                <DetailRow label='Ends' value={viewingEvent.end_time ? formatTimestampShort(viewingEvent.end_time) : '—'} />
                <DetailRow label='Status' value={viewingEvent.status ?? 'open'} />
              </View>
              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole='button'
                  onPress={() => setViewingEvent(null)}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}


      {message && (
        <View style={styles.messageBox}>
          <Text style={styles.message}>{message}</Text>
        </View>
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Scan this QR code with the Scan tab</Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
          <AppButton icon='refresh' onPress={() => setPayload(null)} theme='secondary' title='Generate new QR' />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120, alignItems: 'center' },
  gate: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  gateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  gateTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  gateSubtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  formCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 20, marginBottom: 16, width: '100%' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, marginTop: 6 },
  dateTimeRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateTimeColumn: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  pickerLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.72)', padding: 20 },
  pickerSheet: { width: '100%', maxWidth: 430, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 20 },
  pickerSheetTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', textTransform: 'capitalize' },
  pickerSheetValue: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  iosPicker: { width: '100%' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalButton: { minWidth: 96, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  modalButtonPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalButtonPressed: { opacity: 0.7 },
  modalButtonText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  modalButtonPrimaryText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 16 },
  chipLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
  chip: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, paddingVertical: 10, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primarySoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4, width: '100%' },
  message: { fontSize: 14, fontWeight: '600', flex: 1, color: COLORS.textPrimary },
  messageSuccess: { color: COLORS.success },
  messageError: { color: COLORS.danger },
  resultCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, width: '100%' },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 14 },
  qrBox: { backgroundColor: COLORS.card, padding: 12, borderRadius: 14, marginBottom: 12 },
  payloadText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  inlineText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 10, lineHeight: 19 },
  eventListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  eventListCopy: { flex: 1, minWidth: 180 },
  eventListTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  eventListMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  eventListStatus: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
    color: COLORS.success,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  eventListStatusClosed: { color: '#B33A3A' },
  eventListActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailList: { marginTop: 8, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
  detailValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
