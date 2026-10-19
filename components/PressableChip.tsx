import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function PressableChip({ label, onPress, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
  label: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  labelDisabled: { color: COLORS.textSecondary },
});
