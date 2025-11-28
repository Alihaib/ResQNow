import { useRouter } from "expo-router";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { db } from "../../src/firebase/config";

export default function AdminPanel() {
  const router = useRouter();
  const { role, logout } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== "admin") {
      router.replace("/");
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setUsers(list);
    setLoading(false);
  };

  const approveDoctor = async (id: string) => {
    await updateDoc(doc(db, "users", id), { approved: true });
    alert("Doctor approved!");
    loadUsers();
  };

  const rejectDoctor = async (id: string) => {
    await updateDoc(doc(db, "users", id), { approved: false });
    alert("Doctor rejected.");
    loadUsers();
  };

  const makeAdmin = async (id: string) => {
    await updateDoc(doc(db, "users", id), { role: "admin", approved: true });
    alert("User is now Admin!");
    loadUsers();
  };

  const goHome = () => {
    router.replace("/");
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/auth/login");
  };

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.topRow}>
        <Text style={styles.header}>Admin Panel</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Back to Home */}
      <TouchableOpacity style={styles.backHomeBtn} onPress={goHome}>
        <Text style={styles.backHomeText}>← Back to Home</Text>
      </TouchableOpacity>

      {/* LIST OF USERS */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.role}>Role: {item.role}</Text>
            <Text style={styles.status}>
              Approved: {item.approved ? "✅ Yes" : "❌ No"}
            </Text>

            {item.role === "doctor" && (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveDoctor(item.id)}
                >
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => rejectDoctor(item.id)}
                >
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.role !== "admin" && (
              <TouchableOpacity
                style={styles.adminBtn}
                onPress={() => makeAdmin(item.id)}
              >
                <Text style={styles.btnText}>Make Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: { fontSize: 18, color: "#333" },

  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f9fa",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#e63946",
  },

  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#e63946",
  },
  logoutText: { color: "white", fontSize: 16, fontWeight: "600" },

  backHomeBtn: {
    backgroundColor: "#457b9d",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  backHomeText: { color: "white", fontSize: 16, fontWeight: "600" },

  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
  },

  email: { fontSize: 18, fontWeight: "600" },
  role: { marginTop: 6, fontSize: 16 },
  status: { marginTop: 6, fontSize: 16 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },

  approveBtn: {
    width: "48%",
    backgroundColor: "#2a9d8f",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  rejectBtn: {
    width: "48%",
    backgroundColor: "#e63946",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  adminBtn: {
    marginTop: 15,
    backgroundColor: "#1d3557",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  btnText: { color: "white", fontSize: 16, fontWeight: "600" },
});
