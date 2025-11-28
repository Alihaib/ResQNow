import { useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

const MOCK_EMERGENCIES = [
  {
    id: "1",
    type: "CPR Needed",
    location: "Central Station, Beer Sheva",
    time: "2 min ago",
    priority: "High",
  },
  {
    id: "2",
    type: "Car Accident",
    location: "Highway 4, near Exit 12",
    time: "7 min ago",
    priority: "Medium",
  },
];

export default function AmbulanceDashboard() {
  const router = useRouter();
  const { user, role, approved, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/auth/login");
      else if (role !== "ambulance") router.replace("/");
      else if (!approved) router.replace("/ambulance/pending");
    }
  }, [loading, user, role, approved]);

  if (loading || !user || !approved) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const onAccept = (id: string) => {
    alert(`Marked emergency #${id} as "On the way"`);
  };

  const onComplete = (id: string) => {
    alert(`Marked emergency #${id} as "Completed"`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Ambulance Dashboard</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Nearby Emergencies</Text>

      {/* כאן בעתיד תשים MapView */}
      <View style={styles.placeholderMap}>
        <Text style={styles.placeholderText}>🗺️ Map view coming soon</Text>
      </View>

      {/* רשימת אירועים */}
      <FlatList
        data={MOCK_EMERGENCIES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.info}>📍 {item.location}</Text>
            <Text style={styles.info}>⏱ {item.time}</Text>
            <Text style={styles.priority}>
              Priority:{" "}
              <Text
                style={{
                  fontWeight: "700",
                  color: item.priority === "High" ? "#e63946" : "#e9c46a",
                }}
              >
                {item.priority}
              </Text>
            </Text>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => onAccept(item.id)}
              >
                <Text style={styles.btnText}>On the way</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => onComplete(item.id)}
              >
                <Text style={styles.btnText}>Completed</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.backHomeBtn}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.backHomeText}>← Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 16,
    paddingTop: 45,
  },
  loadingText: { textAlign: "center", marginTop: 40, fontSize: 18 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1d3557",
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e63946",
  },
  logoutText: { color: "#e63946", fontWeight: "600" },

  subtitle: { fontSize: 16, color: "#457b9d", marginBottom: 10 },

  placeholderMap: {
    height: 140,
    backgroundColor: "#e5edf5",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  placeholderText: {
    color: "#1d3557",
    fontSize: 16,
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  type: { fontSize: 18, fontWeight: "700", color: "#1d3557" },
  info: { fontSize: 14, marginTop: 4, color: "#555" },
  priority: { fontSize: 14, marginTop: 4 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  acceptBtn: {
    width: "48%",
    backgroundColor: "#2a9d8f",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  doneBtn: {
    width: "48%",
    backgroundColor: "#457b9d",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },

  backHomeBtn: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  backHomeText: {
    color: "#1d3557",
    fontSize: 16,
    fontWeight: "600",
  },
});
