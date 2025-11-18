import { useRouter } from "expo-router";
import {
    collection,
    doc,
    getDocs,
    updateDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { db } from "../../src/firebase/config";

export default function AdminDashboard() {
  const { role, approved, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // מניעת גישה למי שלא Admin
  useEffect(() => {
    if (role !== "admin") {
      alert("Access denied. Admins only.");
      router.replace("/(tabs)");
    }
  }, [role]);

  // טעינת משתמשים
  const loadUsers = async () => {
    setLoading(true);

    const snapshot = await getDocs(collection(db, "users"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    setUsers(list);
    setLoading(false);
  };

  const approveDoctor = async (id: string) => {
    try {
      await updateDoc(doc(db, "users", id), {
        role: "doctor",
        approved: true
      });

      alert("Doctor approved!");
      loadUsers();
    } catch (err) {
      console.log(err);
      alert("Error approving doctor");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size={40} color="#e63946" />
        <Text style={{ marginTop: 10 }}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.info}>
              Role: <Text style={styles.bold}>{item.role}</Text>
            </Text>
            <Text style={styles.info}>
              Approved:{" "}
              <Text style={styles.bold}>
                {item.approved ? "Yes" : "No"}
              </Text>
            </Text>

            {/* כפתור אישור רק אם הוא ביקש להיות Doctor */}
            {item.role === "doctor" && item.approved === false && (
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approveDoctor(item.id)}
              >
                <Text style={styles.approveText}>Approve Doctor</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

// =======================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5"
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1d3557"
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    elevation: 3
  },
  email: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333"
  },
  info: {
    fontSize: 16,
    marginTop: 5
  },
  bold: {
    fontWeight: "bold",
    color: "#1d3557"
  },
  approveBtn: {
    marginTop: 12,
    backgroundColor: "#2a9d8f",
    padding: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  approveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  }
});
