import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

/**
 * Bottom-navigation items each account type is allowed to see. Tabs that are
 * not listed for the signed-in role are hidden from the bar (`href: null`);
 * the routes still exist so each screen can keep its own role guard.
 */
const VISIBLE_TABS: Record<ProfileRole, string[]> = {
  student: ['index', 'scan', 'history', 'profile'],
  teacher: ['index', 'history', 'teacher', 'profile'],
  administrator: ['index', 'history', 'admin', 'profile'],
};

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRole(null);
      return;
    }
    getProfile(user.id).then((profile) => {
      if (active) setRole(profile?.role ?? 'student');
    });
    return () => {
      active = false;
    };
  }, [user]);

  // While the profile is loading the role is unknown, so every tab stays
  // visible and the bar never flashes a partial set. Once the role is known,
  // only that account type's tabs are rendered.
  const hidden = (name: string) =>
    role !== null && !VISIBLE_TABS[role].includes(name);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarActiveBackgroundColor: 'transparent',
        headerShown: false,
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarLabelStyle: {
          fontSize: width < 360 ? 10 : 11,
          lineHeight: 14,
          fontWeight: '700',
          letterSpacing: 0.15,
        },
        tabBarIconStyle: {
          marginTop: 1,
          marginBottom: 3,
        },
        tabBarItemStyle: {
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 4,
          marginVertical: 2,
          paddingVertical: 2,
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: desktop
          ? {
              position: 'absolute',
              width: Math.min(width - 32, 620),
              left: (width - Math.min(width - 32, 620)) / 2,
              bottom: 14,
              height: 66,
              borderRadius: 18,
              backgroundColor: COLORS.card,
              borderColor: COLORS.border,
              borderWidth: 1,
              borderTopWidth: 1,
              paddingHorizontal: 8,
              paddingBottom: 6,
              paddingTop: 0,
              shadowColor: 'transparent',
              shadowOpacity: 0,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 0,
              elevation: 0,
            }
          : {
              height: width < 360 ? 64 : 70,
              backgroundColor: COLORS.card,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 50,
              marginHorizontal: 12,
              marginBottom: 10,
              paddingBottom: 6,
              paddingTop: 0,
              shadowColor: 'transparent',
              shadowOpacity: 0,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 0,
              elevation: 0,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: hidden('index') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="home" color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: hidden('scan') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="qr-code-scanner" color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: hidden('history') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="history" color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: hidden('teacher') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="event-note" color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: hidden('admin') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="security" color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: hidden('profile') ? null : undefined,
          tabBarIcon: ({ color }) => <MaterialIcons name="person" color={color} size={23} />,
        }}
      />
    </Tabs>
  );
}
