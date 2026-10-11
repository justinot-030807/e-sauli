import { Tabs } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Text, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.headerBackground },
        headerTintColor: theme.headerText,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'MarSU Lost & Found',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🏆</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 22 },
});
