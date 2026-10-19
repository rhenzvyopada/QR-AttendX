import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={COLORS.primary} size="large" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.icon}>
        <MaterialIcons color={COLORS.textSecondary} name={icon} size={32} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 420,
  },
  message: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
});

export default EmptyState;
