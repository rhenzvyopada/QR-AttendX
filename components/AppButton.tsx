import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  theme?: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, icon, theme = 'secondary', onPress, disabled }: Props) {
  const primary = theme === 'primary';

  return (
    <View style={[styles.buttonOuter, disabled && styles.disabled]}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.buttonInner,
          primary ? styles.primaryButton : styles.secondaryButton,
          pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        ]}
      >
        <MaterialIcons
          color={primary ? COLORS.textOnPrimary : COLORS.primaryInk}
          name={icon}
          size={20}
        />
        <Text numberOfLines={1} style={[styles.label, primary && styles.primaryLabel]}>
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: 12,
  },
  buttonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 0,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  primaryPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  secondaryPressed: { backgroundColor: COLORS.surface, borderColor: COLORS.primary },
  disabled: { opacity: 0.55 },
  label: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  primaryLabel: { color: COLORS.textOnPrimary },
});
