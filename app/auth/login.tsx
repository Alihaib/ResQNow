import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { auth } from "../../src/firebase/config";

export default function Login() {
  const router = useRouter();
  const { user, role, approved, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // אם כבר מחובר — נווט אוטומטית
  useEffect(() => {
    if (!loading && user) {
      if (role === "doctor" && !approved) router.replace("/doctor/pending");
      else if (role === "ambulance" && !approved) router.replace("/ambulance/pending");
      else router.replace("/");
    }
  }, [loading, user, role, approved]);

  const login = async () => {
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // שאר הניווט יקרה אוטומטית ב־useEffect
    } catch (e) {
      console.log(e);
      setError("Incorrect email or password.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#777"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        placeholderTextColor="#777"
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={login}>
        <Text style={styles.btnText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/auth/signup")}>
        <Text style={styles.link}>Don't have an account? Create one</Text>
      </TouchableOpacity>
    </View>
  );
}

// ===== Styles =====
const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, justifyContent: "center" },
  title: { fontSize: 34, fontWeight: "bold", textAlign: "center", marginBottom: 25, color: "#e63946" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },

  button: {
    backgroundColor: "#1d3557",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  link: { textAlign: "center", marginTop: 10, fontSize: 16, color: "#457b9d", fontWeight: "600" },

  error: { color: "#e63946", textAlign: "center", marginBottom: 10, fontSize: 15 },
});
