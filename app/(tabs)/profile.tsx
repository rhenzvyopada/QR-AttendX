import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PageHeader from '@/components/PageHeader';
import TextField from '@/components/TextField';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, Profile, ProfileRole, updateProfile } from '@/lib/profiles';

type PersonalInfo = Pick<
  Profile,
  'phone' | 'address' | 'city' | 'date_of_birth' | 'emergency_contact'
>;

const PERSONAL_INFO_FIELDS = [
  { key: 'phone', label: 'Phone number', icon: 'phone' },
  { key: 'address', label: 'Street address', icon: 'home' },
  { key: 'city', label: 'City', icon: 'location-city' },
  { key: 'date_of_birth', label: 'Date of birth', icon: 'cake' },
  { key: 'emergency_contact', label: 'Emergency contact', icon: 'contact-phone' },
] as const;

type ProfileActionProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
};

function ProfileAction({ icon, label, onPress, disabled, muted }: ProfileActionProps) {
  const color = muted ? COLORS.textSecondary : COLORS.primaryDark;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileAction,
        muted ? styles.profileActionGhost : styles.profileActionPrimary,
        pressed && styles.profileActionPressed,
        disabled && styles.profileActionDisabled,
      ]}
    >
      {disabled ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <MaterialIcons color={color} name={icon} size={20} />
      )}
      <Text style={[styles.profileActionLabel, muted && styles.profileActionLabelMuted]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ProfileInfoRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  selectable?: boolean;
};

function ProfileInfoRow({ icon, label, value, selectable }: ProfileInfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialIcons color={COLORS.primaryInk} name={icon} size={19} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text selectable={selectable} style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    phone: null,
    address: null,
    city: null,
    date_of_birth: null,
    emergency_contact: null,
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadProfile = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const nextProfile = await getProfile(session.user.id);
    setProfile(nextProfile);
    setFullName(nextProfile?.full_name ?? '');
    setPersonalInfo({
      phone: nextProfile?.phone ?? null,
      address: nextProfile?.address ?? null,
      city: nextProfile?.city ?? null,
      date_of_birth: nextProfile?.date_of_birth ?? null,
      emergency_contact: nextProfile?.emergency_contact ?? null,
    });
    setMessage(nextProfile ? '' : 'Unable to load your profile.');
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function saveProfile() {
    if (!session?.user.id) return;
    setSaving(true);
    setMessage('');
    const updates = {
      full_name: fullName.trim() || null,
      phone: personalInfo.phone?.trim() || null,
      address: personalInfo.address?.trim() || null,
      city: personalInfo.city?.trim() || null,
      date_of_birth: personalInfo.date_of_birth?.trim() || null,
      emergency_contact: personalInfo.emergency_contact?.trim() || null,
    };
    const { error } = await updateProfile(session.user.id, {
      ...updates,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const now = new Date().toISOString();
    const savedProfile: Profile = {
      id: session.user.id,
      email: session.user.email ?? '',
      full_name: updates.full_name,
      role: profile?.role ?? 'student',
      phone: updates.phone,
      address: updates.address,
      city: updates.city,
      date_of_birth: updates.date_of_birth,
      emergency_contact: updates.emergency_contact,
      created_at: profile?.created_at ?? session.user.created_at,
      updated_at: now,
    };
    setProfile(savedProfile);
    const nextProfile = await getProfile(session.user.id);
    if (nextProfile) setProfile(nextProfile);
    setEditing(false);
    setMessage('Profile updated.');
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  const displayName = profile?.full_name || 'No name set';
  const email = session?.user.email ?? 'No email available';
  const initial = (profile?.full_name || email).trim().charAt(0).toUpperCase() || '?';
  const roleLabels: Record<ProfileRole, string> = {
    student: 'Student',
    teacher: 'Teacher',
    administrator: 'Administrator',
  };
  const roleLabel = (profile?.role && roleLabels[profile.role]) || 'Unavailable';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <PageHeader
          eyebrow="Account"
          title="My Profile"
          
        />

        <View style={styles.profileCard}>
          <View style={styles.identityBanner}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text numberOfLines={2} style={styles.identityName}>{displayName}</Text>
              <Text numberOfLines={1} style={styles.identityEmail}>{email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
            <ProfileAction
              disabled={saving}
              icon={editing ? 'check' : 'edit'}
              label={saving ? 'Saving…' : editing ? 'Save' : 'Edit Profile'}
              onPress={editing ? saveProfile : () => setEditing(true)}
            />
          </View>

          <View style={styles.detailsPanel}>
            <Text style={styles.groupTitle}>Account Information</Text>

            {editing ? (
              <View style={styles.groupCard}>
                <View style={styles.editFields}>
                  <TextField
                    autoCapitalize="words"
                    label="Full name"
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    value={fullName}
                  />
                  <TextField
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    label="Phone number"
                    onChangeText={(phone) => setPersonalInfo((current) => ({ ...current, phone }))}
                    placeholder="Enter your phone number"
                    value={personalInfo.phone ?? ''}
                  />
                  <TextField
                    autoCapitalize="words"
                    label="Street address"
                    onChangeText={(address) => setPersonalInfo((current) => ({ ...current, address }))}
                    placeholder="Enter your street address"
                    value={personalInfo.address ?? ''}
                  />
                  <TextField
                    autoCapitalize="words"
                    label="City"
                    onChangeText={(city) => setPersonalInfo((current) => ({ ...current, city }))}
                    placeholder="Enter your city"
                    value={personalInfo.city ?? ''}
                  />
                  <TextField
                    label="Date of birth"
                    onChangeText={(date_of_birth) =>
                      setPersonalInfo((current) => ({ ...current, date_of_birth }))
                    }
                    placeholder="YYYY-MM-DD"
                    value={personalInfo.date_of_birth ?? ''}
                  />
                  <TextField
                    autoCapitalize="words"
                    label="Emergency contact (name and phone)"
                    onChangeText={(emergency_contact) =>
                      setPersonalInfo((current) => ({ ...current, emergency_contact }))
                    }
                    placeholder="Enter a trusted contact"
                    value={personalInfo.emergency_contact ?? ''}
                  />
                </View>
                <View style={styles.cancelAction}>
                  <ProfileAction
                    icon="close"
                    label="Cancel"
                    muted
                    onPress={() => {
                      setFullName(profile?.full_name ?? '');
                      setPersonalInfo({
                        phone: profile?.phone ?? null,
                        address: profile?.address ?? null,
                        city: profile?.city ?? null,
                        date_of_birth: profile?.date_of_birth ?? null,
                        emergency_contact: profile?.emergency_contact ?? null,
                      });
                      setEditing(false);
                      setMessage('');
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.groupCard}>
                <ProfileInfoRow icon="person-outline" label="Display name" value={displayName} />
                {PERSONAL_INFO_FIELDS.map(({ key, label, icon }) => (
                  <ProfileInfoRow
                    icon={icon}
                    key={key}
                    label={label}
                    value={profile?.[key] || 'Not added'}
                  />
                ))}
                <ProfileInfoRow icon="school" label="Account type" value={roleLabel} />
              </View>
            )}

            <Text style={styles.groupTitle}>Privacy &amp; account</Text>
            <View style={styles.groupCard}>
              <ProfileInfoRow
                icon="fingerprint"
                label="User ID"
                selectable
                value={session?.user.id ?? ''}
              />
              <Pressable
                accessibilityRole="button"
                onPress={signOut}
                style={({ pressed }) => [styles.signOutRow, pressed && styles.rowPressed]}
              >
                <View style={[styles.infoIcon, styles.signOutIcon]}>
                  <MaterialIcons color={COLORS.danger} name="logout" size={19} />
                </View>
                <Text style={styles.signOutLabel}>Sign out</Text>
                <MaterialIcons color={COLORS.textSecondary} name="chevron-right" size={22} />
              </Pressable>
            </View>

            {!!message && (
              <Text style={[styles.message, message === 'Profile updated.' && styles.successMessage]}>
                {message}
              </Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, fontSize: 15 },
  profileCard: {
    width: '100%',
    gap: 22,
  },
  identityBanner: {
    width: '100%',
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  avatarText: { color: COLORS.primaryDark, fontSize: 25, fontWeight: '800' },
  identityCopy: { flex: 1, minWidth: 0 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },
  roleText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  identityName: { color: COLORS.textOnPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  identityEmail: {
    color: COLORS.onPrimaryMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    maxWidth: '100%',
  },
  detailsPanel: { width: '100%', minWidth: 0 },
  groupTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginHorizontal: 5,
    marginBottom: 9,
    marginTop: 2,
  },
  groupCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  infoValue: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  editFields: { paddingTop: 16 },
  cancelAction: { alignItems: 'center', marginVertical: 12 },
  signOutRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signOutIcon: { backgroundColor: COLORS.surface },
  signOutLabel: { flex: 1, color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  rowPressed: { opacity: 0.65 },
  message: { color: COLORS.danger, fontSize: 13, lineHeight: 19, marginTop: 0, marginBottom: 10, fontWeight: '600' },
  successMessage: { color: COLORS.success },
  profileAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 },
  profileActionPrimary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.card },
  profileActionGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  profileActionPressed: { opacity: 0.75 },
  profileActionDisabled: { opacity: 0.55 },
  profileActionLabel: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '800' },
  profileActionLabelMuted: { color: COLORS.textSecondary },
});
