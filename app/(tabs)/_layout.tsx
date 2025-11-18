import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#e63946",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#ddd",
          paddingBottom: 6,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      {/* דוגמה למסך נוסף אם תרצה בעתיד */}
      {/* 
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
      */}

    </Tabs>
  );
}
