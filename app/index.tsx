import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function Home() {
  const { user, role, approved, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/auth/login");
      }
      else if (role === "admin") {
        router.replace("/admin");
      }
      else if (role === "doctor" && approved === false) {
        router.replace("/pending");
      }
    }
  }, [user, role, approved, loading]);

  if (loading) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>Welcome to ResQNow</Text>
    </View>
  );
}
