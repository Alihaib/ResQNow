import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../src/firebase/config";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "doctor">("user"); // default

  const signup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const approvedValue = role === "doctor" ? false : true;

      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        role,
        approved: approvedValue
      });

      alert(
        role === "doctor"
          ? "Account created! Waiting for admin approval."
          : "Account created!"
      );

      router.replace("/auth/login");
    } catch (error: any) {
      alert(error.message);
      console.log("Signup error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>Select Role</Text>

      <View style={styles.roles}>
        <TouchableOpacity
          style={[styles.roleBtn, role === "user" && styles.selected]}
          onPress={() => setRole("user")}
        >
          <Text style={styles.roleText}>User</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleBtn, role === "doctor" && styles.selected]}
          onPress={() => setRole("doctor")}
        >
          <Text style={styles.roleText}>Doctor</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={signup}>
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 30 },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 10,
    borderRadius: 10
  },
  label: { marginVertical: 10, fontSize: 18, fontWeight: "600" },
  roles: { flexDirection: "row", justifyContent: "center", gap: 10 },
  roleBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 10,
    width: 120,
    alignItems: "center"
  },
  selected: { backgroundColor: "#e63946", borderColor: "#e63946" },
  roleText: { color: "#fff", fontWeight: "600" },
  button: {
    marginTop: 20,
    backgroundColor: "#1d3557",
    padding: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "bold" }
});
