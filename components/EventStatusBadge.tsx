import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export type EventStatus = 'open' | 'closed';

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const isClosed = status === 'closed';

  return (
    <View
      style={[styles.badge, isClosed && styles.badgeClosed, !isClosed && styles.badgeOpen]}
    >
      <MaterialIcons
        color={isClosed ? COLORS.danger : COLORS.success}
        name={isClosed ? 'lock' : 'check-circle'}
        size={14}
      />
      <Text style={[styles.badgeText, isClosed && styles.badgeTextClosed]}>
        {isClosed ? 'Closed' : 'Open'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FCF3E3',
    borderWidth: 1,
    borderColor: '#E4C9A6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 0,
  },
  badgeOpen: { backgroundColor: '#E6F4EA', borderColor: '#BBF0C9', shadowColor: '#111111' },
  badgeClosed: { backgroundColor: '#F6E7E7', borderColor: '#E7B8B8' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#6B5A1F' },
  badgeTextClosed: { color: '#8A2B2B' },
});
