import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError.message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.panel, compact && styles.compactPanel]}>
          <Header title="QR Attendance" />
          <Text style={styles.eyebrow}>SECURE CHECK-IN</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your events and attendance.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@school.edu"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.textSecondary}
          secureTextEntry
          editable={!loading}
        />

          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
            ) : (
              <AppButton title="Sign In" icon="login" theme="primary" onPress={handleLogin} />
            )}
            <Link href="/register" style={styles.link}>Don't have an account? Sign Up</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  panel: { width: '100%', maxWidth: 480, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, paddingHorizontal: 32, paddingTop: 18, paddingBottom: 32, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.08, shadowRadius: 30 },
  compactPanel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderWidth: 0, borderRadius: 0, shadowOpacity: 0 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 16, lineHeight: 24, color: COLORS.textSecondary, marginBottom: 22 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 10 },
  input: { minHeight: 50, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.textPrimary },
  error: { color: COLORS.danger, marginTop: 12, textAlign: 'center' },
  actions: { width: '100%', marginTop: 20, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 10 },
});
