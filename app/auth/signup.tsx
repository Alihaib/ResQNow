import { Link, useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { auth } from "../../src/firebase/config";

export default function SignUp() {
  const { user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) router.replace("/");
  }, [user]);

  const signup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (e) {
      alert("Signup failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.button} onPress={signup}>
        <Text style={styles.btnText}>Sign Up</Text>
      </TouchableOpacity>

      <Link href="/auth/login">
        <Text style={styles.link}>Already have an account? Login</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 30 },
  input: { padding: 14, borderWidth: 1, borderColor: "#ccc", marginBottom: 10, borderRadius: 10 },
  button: { backgroundColor: "#1d3557", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 18 },
  link: { textAlign: "center", marginTop: 15, color: "#e63946" },
});
