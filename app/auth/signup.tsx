import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../src/firebase/config";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // user / doctor / ambulance
  const [error, setError] = useState("");

  const signup = async () => {
    setError("");

    try {
      // יצירת משתמש ב־Auth
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // הגדרת approved אוטומטית
      const isApproved = role === "user";

      // שמירה ב־Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        email,
        role,
        approved: isApproved,
      });

      alert("Account created!");

      if (role === "doctor") router.replace("/doctor/pending");
      else if (role === "ambulance") router.replace("/ambulance/pending");
      else router.replace("/");

    } catch (e: any) {
      console.log(e);
      setError("Signup failed");
      alert("Signup failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

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
        placeholderTextColor="#777"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* בחירת סוג משתמש */}
      <Text style={styles.label}>Select Account Type:</Text>

      <View style={styles.roleRow}>
        {["user", "doctor", "ambulance"].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roleButton, role === r && styles.selectedRole]}
            onPress={() => setRole(r)}
          >
            <Text style={styles.roleText}>
              {r === "user" && "Regular User"}
              {r === "doctor" && "Doctor"}
              {r === "ambulance" && "Ambulance Driver"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={signup}>
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/auth/login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

// ====== Styles ======
const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 25, color: "#e63946" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },

  label: { fontSize: 16, marginVertical: 10, fontWeight: "600", color: "#1d3557" },

  roleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },

  roleButton: {
    width: "32%",
    paddingVertical: 10,
    backgroundColor: "#f1f1f1",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },

  selectedRole: {
    backgroundColor: "#1d3557",
    borderColor: "#1d3557",
  },

  roleText: {
    color: "#1d3557",
    fontWeight: "600",
  },

  button: {
    backgroundColor: "#e63946",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  link: {
    textAlign: "center",
    marginTop: 10,
    color: "#1d3557",
    fontSize: 16,
    fontWeight: "600",
  },

  error: { color: "red", textAlign: "center", marginBottom: 10 },
});
