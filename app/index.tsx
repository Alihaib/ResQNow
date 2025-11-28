import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function Home() {
const { user, role, approved, logout } = useAuth();
  const router = useRouter();

  // ניתוב אוטומטי לפי ROLE
  useEffect(() => {
    if (!user) return; // לא מחובר → יראה כפתורי Login/Signup

    if (role === "doctor" && approved === false) {
      router.replace("/doctor/pending");
    }

    if (role === "doctor" && approved === true) {
      router.replace("/doctor/dashboard");
    }

    if (role === "admin") {
      router.replace("/admin/panel");
    }
  }, [user, role, approved]);

  // --- משתמש לא מחובר ---
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ResQNow</Text>
        <Text style={styles.subtitle}>Smart First Aid Assistant</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/auth/signup")}
        >
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- משתמש רגיל מחובר (ROLE = user) ---
  if (role === "user") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>You are logged in as a regular user.</Text>

      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      </View>
    );
  }

  // למקרה שלא זוהה ROLE (בעיית נתונים)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#e63946",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#1d3557",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#e63946",
    paddingVertical: 15,
    width: "80%",
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e63946",
    paddingVertical: 15,
    width: "80%",
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e63946",
    fontSize: 18,
    fontWeight: "600",
  },
});
