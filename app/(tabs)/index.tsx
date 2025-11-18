import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { auth } from "../../src/firebase/config";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <Text>Loading...</Text>;

  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user]);

  const logout = async () => {
    await signOut(auth);
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ResQNow</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 40, fontWeight: "bold", color: "#e63946" },
  logoutButton: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e63946",
    borderRadius: 10,
  },
  logoutText: { fontSize: 18, color: "#e63946" },
});
