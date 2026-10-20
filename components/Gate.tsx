import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { getAdminProfile, isAdministrator } from '@/lib/profiles';

export function Gate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [authorized, setAuthorized] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    let active = true;
    getAdminProfile().then((profile) => {
      if (!active) return;
      setAuthorized(isAdministrator(profile?.role ?? 'student'));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#393E41" size="large" />
        <Text style={styles.text}>Checking access...</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.container}>
        <View style={styles.icon} />
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>
          This section is only available to administrators.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F1F1EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { fontSize: 14, color: '#5D5D5A' },
  title: { fontSize: 20, fontWeight: '800', color: '#171717', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#5D5D5A',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 21,
  },
});

export default Gate;