import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../src/firebase/config";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "doctor">("user");

  const signup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await setDoc(doc(db, "users", userCred.user.uid), {
        email,
        role,
        approved: role === "doctor" ? false : true,
      });

      router.replace("/");
    } catch (e) {
      alert("Signup failed.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.box}>
        <Text style={styles.title}>Create Account</Text>

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

        <Text style={styles.label}>Choose Role</Text>

        <View style={styles.roles}>
          <TouchableOpacity
            style={[styles.roleBtn, role === "user" && styles.selectedRole]}
            onPress={() => setRole("user")}
          >
            <Text
              style={{
                color: role === "user" ? "white" : "#1d3557",
                fontWeight: "600",
              }}
            >
              User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleBtn, role === "doctor" && styles.selectedRole]}
            onPress={() => setRole("doctor")}
          >
            <Text
              style={{
                color: role === "doctor" ? "white" : "#1d3557",
                fontWeight: "600",
              }}
            >
              Doctor
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={signup}>
          <Text style={styles.btnText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/auth/login")}>
          <Text style={styles.link}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20, justifyContent: "center" },
  box: { backgroundColor: "white", padding: 25, borderRadius: 12, elevation: 3 },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", color: "#e63946", marginBottom: 20 },
  input: { padding: 14, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, marginBottom: 12 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: "600" },
  roles: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  roleBtn: {
    width: "48%",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1d3557",
    alignItems: "center",
  },
  selectedRole: { backgroundColor: "#1d3557" },
  button: {
    backgroundColor: "#e63946",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "white", fontSize: 18 },
  link: { marginTop: 15, color: "#457b9d", textAlign: "center", fontSize: 16 },
});
