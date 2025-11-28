import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

export default function PendingDoctor() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Awaiting Approval</Text>

      <Text style={styles.text}>
        Hello {user?.email}, your account is registered as a doctor,
        but it still requires admin approval.
      </Text>

      <Text style={styles.subtext}>
        You will be notified once the admin approves your account.
      </Text>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.homeButtonText}>← Back to Home</Text>
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
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e63946",
    marginBottom: 20,
    textAlign: "center",
  },
  text: {
    fontSize: 18,
    color: "#1d3557",
    textAlign: "center",
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: "#457b9d",
    textAlign: "center",
    marginBottom: 40,
  },
  homeButton: {
    backgroundColor: "#1d3557",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
