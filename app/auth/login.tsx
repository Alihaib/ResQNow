import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { auth } from "../../src/firebase/config";

export default function Login() {
  const { user, role, approved } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

useEffect(() => {
  if (!user) return;

  if (role === "admin") router.replace("/admin/panel");
  else if (role === "doctor" && !approved) router.replace("/doctor/pending");
  else router.replace("/"); // user רגיל → נכנס למסך הבית
}, [user, role, approved]);


  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      alert("Login failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.button} onPress={login}>
        <Text style={styles.btnText}>Login</Text>
      </TouchableOpacity>

      <Link href="/auth/signup">
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 30 },
  input: { padding: 14, borderWidth: 1, borderColor: "#ccc", marginBottom: 10, borderRadius: 10 },
  button: { backgroundColor: "#e63946", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 18 },
  link: { textAlign: "center", marginTop: 15, color: "#1d3557" },
});
