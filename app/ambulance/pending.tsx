import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

export default function AmbulancePending() {
  const router = useRouter();
  const { user, role, approved, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/auth/login");
      else if (role !== "ambulance") router.replace("/");
      else if (approved) router.replace("/ambulance/dashboard");
    }
  }, [loading, user, role, approved]);

  if (loading || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ambulance Account</Text>
      <Text style={styles.text}>
        Your account is awaiting admin approval.
      </Text>
      <Text style={styles.subText}>
        Once approved, you’ll be able to view real-time emergencies in your area.
      </Text>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
        <Text style={styles.homeText}>← Back to Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#e63946",
    marginBottom: 10,
    textAlign: "center",
  },
  text: {
    fontSize: 17,
    textAlign: "center",
    color: "#1d3557",
  },
  subText: {
    fontSize: 15,
    textAlign: "center",
    color: "#457b9d",
    marginTop: 10,
  },
  homeBtn: {
    marginTop: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#457b9d",
  },
  homeText: { color: "white", fontSize: 16, fontWeight: "600" },
  logoutBtn: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e63946",
  },
  logoutText: { color: "#e63946", fontSize: 16, fontWeight: "600" },
});
