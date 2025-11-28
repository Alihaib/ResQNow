import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "../../src/firebase/config";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const logout = async () => {
    await signOut(auth);
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctor Dashboard</Text>
      <Text style={styles.subtitle}>Welcome Dr. {user?.email}</Text>

      <TouchableOpacity style={styles.btn} onPress={() => router.push("/")}>
        <Text style={styles.btnText}>← Back to Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#f8f9fa" },
  title: { fontSize: 34, fontWeight: "700", textAlign: "center", color: "#1d3557" },
  subtitle: { fontSize: 18, textAlign: "center", marginTop: 10, marginBottom: 30 },
  btn: {
    backgroundColor: "#457b9d",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "white", fontSize: 18 },
  logoutBtn: {
    backgroundColor: "#e63946",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: { color: "white", fontSize: 18 },
});
