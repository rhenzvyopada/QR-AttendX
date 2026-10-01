import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';

export default function Index() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          desktop && styles.desktopScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.layout, desktop && styles.desktopLayout]}>
          <View style={[styles.hero, desktop && styles.desktopHero]}>
            <View style={styles.brandRow}>
              <View style={styles.logoCircle}>
                <MaterialIcons name="school" size={30} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.brandName}>QR AttendX</Text>
                <Text style={styles.brandMeta}>ATTENDACE SCHOOL SYSTEM</Text>
              </View>
            </View>

            <Text style={styles.eyebrow}>SMART EVENT CHECK-IN</Text>
            <Text style={[styles.heroTitle, desktop && styles.desktopHeroTitle]}>
              Attendance that keeps everyone moving.
            </Text>
            <Text style={styles.heroText}>
              Scan event QR codes, review your attendance, and keep your school
              activity records in one secure place.
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>QR AttendX is ready</Text>
            </View>
            <Text style={styles.credit}>Developed by Rhenzvy Opada</Text>
          </View>

          <View style={[styles.actionCard, desktop && styles.desktopActionCard]}>
            <Text style={styles.actionEyebrow}>QUICK ACTIONS</Text>
            <Text style={styles.actionTitle}>What would you like to do?</Text>
            <Text style={styles.actionText}>
              Choose an option below to continue.
            </Text>

            <AppButton
              theme="primary"
              title="Scan QR Code"
              icon="qr-code-scanner"
              onPress={() => router.push('/scan')}
            />
            <AppButton
              title="Attendance History"
              icon="history"
              onPress={() => router.push('/history')}
            />
            <AppButton
              title="View Profile"
              icon="person"
              onPress={() => router.push('/profile')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 104,
  },
  desktopScrollContent: { paddingHorizontal: 40, paddingTop: 56, paddingBottom: 128 },
  layout: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 24 },
  desktopLayout: { flexDirection: 'row', alignItems: 'stretch', gap: 32 },
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 22,
    padding: 24,
    overflow: 'hidden',
  },
  desktopHero: { flex: 1, minHeight: 450, padding: 40, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  brandName: { fontSize: 18, fontWeight: '700', color: COLORS.textOnPrimary },
  brandMeta: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: COLORS.onPrimaryMuted, marginTop: 3 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: COLORS.onPrimaryMuted, marginBottom: 12 },
  heroTitle: { fontSize: 32, lineHeight: 39, fontWeight: '700', color: COLORS.textOnPrimary, maxWidth: 540 },
  desktopHeroTitle: { fontSize: 44, lineHeight: 52 },
  heroText: { fontSize: 16, lineHeight: 25, color: COLORS.onPrimarySoft, maxWidth: 570, marginTop: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.successLight, marginRight: 9 },
  statusText: { fontSize: 13, fontWeight: '600', color: COLORS.onPrimarySoft },
  credit: { fontSize: 12, color: COLORS.onPrimaryMuted, marginTop: 10 },
  actionCard: {
    width: '100%',
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 24,
  },
  desktopActionCard: { width: 400, justifyContent: 'center', padding: 32 },
  actionEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, color: COLORS.primary, marginBottom: 8 },
  actionTitle: { fontSize: 25, lineHeight: 32, fontWeight: '700', color: COLORS.textPrimary },
  actionText: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginTop: 6, marginBottom: 24 },
});
