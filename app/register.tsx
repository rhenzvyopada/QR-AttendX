import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import TextField from '@/components/TextField';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';
import type { ProfileRole } from '@/lib/profiles';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<ProfileRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: authError } = await signUp(email.trim(), password, {
      full_name: fullName.trim(),
      role,
    });
    setLoading(false);

    if (authError) setError(authError.message);
    else if (!data.session) setError('Check your email to confirm your account, then sign in.');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.panel, compact && styles.compactPanel]}>
          <Header title="QR AttendX" />
          
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose your role and start checking in with confidence.</Text>

          <TextField
            autoCapitalize="words"
            label="Full Name"
            onChangeText={setFullName}
            placeholder="Your full name"
            value={fullName}
          />
          <TextField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="Your email address"
            value={email}
          />

          <Text style={styles.label}>Account Type</Text>
          <View accessibilityRole="radiogroup" style={styles.roles}>
            {(['student', 'teacher', 'administrator'] as const).map((option) => {
              const active = role === option;
              return (
                <Pressable
                  accessibilityLabel={`${option === 'student' ? 'Student' : option === 'teacher' ? 'Teacher' : 'Administrator'} account`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  key={option}
                  onPress={() => setRole(option)}
                  style={[styles.role, active && styles.activeRole]}
                >
                  <MaterialIcons
                    color={active ? COLORS.primaryDark : COLORS.textSecondary}
                    name={option === 'student' ? 'school' : option === 'teacher' ? 'badge' : 'admin-panel-settings'}
                    size={18}
                  />
                  <Text style={[styles.roleText, active && styles.activeRoleText]}>
                    {option === 'student' ? 'Student' : option === 'teacher' ? 'Teacher' : 'Administrator'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Password"
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            value={password}
          />
          <TextField
            label="Confirm Password"
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            secureTextEntry
            value={confirmPassword}
          />

          {error && (
            <View style={styles.errorBox}>
              <MaterialIcons color={COLORS.danger} name="error-outline" size={16} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={styles.loader} />
            ) : (
              <AppButton icon="person-add" onPress={handleRegister} theme="primary" title="Create Account" />
            )}
            <Link href="/login" style={styles.link}>Already have an account? Sign In</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  panel: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 18,
    paddingBottom: 32,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  compactPanel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderWidth: 0, borderRadius: 0, shadowOpacity: 0 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.primaryInk, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, marginTop: 4 },
  roles: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  role: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 12,
  },
  activeRole: { backgroundColor: COLORS.accent, borderColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  activeRoleText: { color: COLORS.primaryDark, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2, marginBottom: 6 },
  error: { color: COLORS.danger, fontSize: 14, flexShrink: 1, textAlign: 'center' },
  actions: { width: '100%', marginTop: 12, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primaryInk, textAlign: 'center', fontWeight: '700', fontSize: 15, paddingVertical: 10 },
});
