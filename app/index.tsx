import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, role, approved, logout, loading } = useAuth();

  // ניווט לפי סטטוס משתמש – רק אחרי שה־Auth נטען
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/auth/login");
      } else if (role === "doctor" && approved === false) {
        router.replace("/doctor/pending");
      } else if (role === "ambulance" && approved === false) {
        router.replace("/ambulance/pending");
      }
    }
  }, [loading, user, role, approved]);

  if (loading || !user) {
    return (
      <View style={styles.loadingPage}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* כותרת */}
      <View style={styles.header}>
        <Text style={styles.title}>ResQNow</Text>
        <Text style={styles.subtitle}>Your Intelligent Emergency Assistant</Text>
      </View>

      {/* כפתורי פעולה */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => alert("Emergency screen coming soon")}
        >
          <Text style={styles.mainButtonText}>🚨 Emergency</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => alert("Profile coming soon")}
        >
          <Text style={styles.secondaryButtonText}>👤 Profile</Text>
        </TouchableOpacity>

        {/* Doctor Dashboard – רק לרופא מאושר */}
        {role === "doctor" && approved && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/doctor/dashboard")}
          >
            <Text style={styles.secondaryButtonText}>🩺 Doctor Dashboard</Text>
          </TouchableOpacity>
        )}

        {/* Ambulance Dashboard – רק לאמבולנס מאושר */}
        {role === "ambulance" && approved && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/ambulance/dashboard")}
          >
            <Text style={styles.secondaryButtonText}>🚑 Ambulance Dashboard</Text>
          </TouchableOpacity>
        )}

        {/* Admin Panel – רק לאדמין */}
        {role === "admin" && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: "#e63946" }]}
            onPress={() => router.push("/admin/panel")}
          >
            <Text style={[styles.secondaryButtonText, { color: "#e63946" }]}>
              🔧 Admin Panel
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: { fontSize: 18, color: "#333" },

  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#e63946",
  },
  subtitle: {
    fontSize: 16,
    color: "#457b9d",
    marginTop: 6,
  },
  buttonsContainer: {
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  mainButton: {
    width: "90%",
    backgroundColor: "#e63946",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  mainButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "90%",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#1d3557",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#1d3557",
    fontSize: 17,
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 40,
    alignSelf: "center",
    borderColor: "#e63946",
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  logoutText: {
    color: "#e63946",
    fontSize: 16,
    fontWeight: "600",
  },
});
