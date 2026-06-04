import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#13192B',
          borderTopColor: '#1F2937',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📊</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📜</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          href: '/stock',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📈</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="udhar"
        options={{
          title: 'Udhar',
          href: '/udhar',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🤝</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          href: '/orders',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🛒</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  );
}
