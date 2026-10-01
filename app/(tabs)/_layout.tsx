import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';
import { COLORS } from '@/constants/colors';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const navWidth = Math.min(width - 48, 760);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarActiveBackgroundColor: COLORS.primarySoft,
        headerShown: false,
        headerStyle: { backgroundColor: COLORS.card },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarLabelStyle: { fontSize: width < 360 ? 10 : 12, lineHeight: 16, fontWeight: '600' },
        tabBarIconStyle: { marginTop: 0 },
        tabBarItemStyle: {
          minHeight: 48,
          marginHorizontal: 4,
          marginVertical: 4,
          paddingVertical: 4,
          borderRadius: 14,
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: desktop
          ? {
              position: 'absolute',
              width: navWidth,
              left: (width - navWidth) / 2,
              bottom: 22,
              height: 72,
              borderRadius: 22,
              backgroundColor: COLORS.elevated,
              borderWidth: 1,
              borderTopWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              shadowColor: COLORS.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
            }
          : {
              height: width < 360 ? 64 : 68,
              backgroundColor: COLORS.elevated,
              borderTopColor: COLORS.border,
              paddingBottom: 6,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <MaterialIcons name="qr-code-scanner" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <MaterialIcons name="history" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          tabBarIcon: ({ color }) => <MaterialIcons name="event-note" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" color={color} size={25} />,
        }}
      />
    </Tabs>
  );
}
