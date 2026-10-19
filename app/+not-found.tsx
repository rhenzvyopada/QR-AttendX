import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';

import { COLORS } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.hint}>The page you are looking for does not exist.</Text>
          <Link href="/" style={styles.link}>
            Go back to Home screen!
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  code: { fontSize: 14, fontWeight: '800', letterSpacing: 2, color: COLORS.primaryInk },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  hint: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: COLORS.primaryInk, paddingVertical: 8 },
});
