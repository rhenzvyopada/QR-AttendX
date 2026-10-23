import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
          <Header title="QR AttendX" />
          <Text style={styles.title}>Log in your account</Text>
          <Text style={styles.subtitle}></Text>

          <TextField
            autoCapitalize="none"
            editable={!loading}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="Your email address"
            value={email}
          />

          <TextField
            editable={!loading}
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
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
              <AppButton icon="login" onPress={handleLogin} theme="primary" title="Sign In" />
            )}
            <Link href="/register" style={styles.link}>
              Don't have an account? Sign Up
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface }, // Changed to surface for better contrast with the card
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  panel: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 18,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  
  // UPDATED: Added border, borderRadius, and margins for mobile
  compactPanel: { 
    paddingHorizontal: 20, 
    paddingTop: 24, 
    paddingBottom: 32, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 20, 
    marginHorizontal: 10, // Adds spacing from the screen edges
    backgroundColor: COLORS.card,
  },
  
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.primaryInk, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2, marginBottom: 6 },
  error: { color: COLORS.danger, fontSize: 14, flexShrink: 1, textAlign: 'center' },
  actions: { width: '100%', marginTop: 12, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primaryInk, textAlign: 'center', fontWeight: '700', fontSize: 15, paddingVertical: 10 },
});