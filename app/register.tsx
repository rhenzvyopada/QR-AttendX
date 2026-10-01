import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import AppButton from '@/components/AppButton';
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
        <Text style={styles.eyebrow}>JOIN QR ATTENDANCE</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Choose your role and start checking in with confidence.</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={COLORS.textSecondary} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your.email@school.edu" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Account Type</Text>
        <View style={styles.roles}>
          {(['student', 'teacher'] as const).map((option) => (
            <Pressable key={option} onPress={() => setRole(option)} style={[styles.role, role === option && styles.activeRole]}>
              <Text style={[styles.roleText, role === option && styles.activeRoleText]}>{option === 'student' ? 'Student' : 'Teacher'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" placeholderTextColor={COLORS.textSecondary} secureTextEntry />

        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : <AppButton title="Create Account" icon="person-add" theme="primary" onPress={handleRegister} />}
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
  panel: { width: '100%', maxWidth: 520, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, padding: 32, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.08, shadowRadius: 30 },
  compactPanel: { paddingHorizontal: 20, paddingVertical: 24, borderWidth: 0, borderRadius: 0, shadowOpacity: 0 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 16, lineHeight: 24, color: COLORS.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 10 },
  input: { minHeight: 50, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.textPrimary },
  roles: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  activeRole: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontWeight: '600' },
  activeRoleText: { color: COLORS.primary, fontWeight: '700' },
  error: { color: COLORS.danger, marginTop: 12, textAlign: 'center' },
  actions: { width: '100%', marginTop: 20, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 10 },
});
