import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  label?: string;
};

export default function PickerField({ value, icon, onPress, label }: Props) {
  return (
    <View style={styles.fieldOuter}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.fieldInner, pressed && styles.pressed]}
      >
        <MaterialIcons color={COLORS.primaryInk} name={icon} size={20} />
        <Text numberOfLines={1} style={styles.value}>
          {value}
        </Text>
        <MaterialIcons color={COLORS.textSecondary} name="keyboard-arrow-down" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldOuter: {
    width: '100%',
    marginBottom: 12,
  },
  fieldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pressed: { backgroundColor: COLORS.surface },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
});
