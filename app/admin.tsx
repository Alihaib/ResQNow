import { useRouter } from "expo-router";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { db, auth } from "../src/firebase/config";
import { signOut } from "firebase/auth";

export default function AdminPanel() {
  const { user, role } = useAuth();
  const router = useRouter();

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
    alert("Doctor rejected!");
    loadUsers();
  };

  const makeAdmin = async (id: string) => {
    await updateDoc(doc(db, "users", id), { role: "admin", approved: true });
    alert("User is now an Admin!");
    loadUsers();
  };

  const goHome = () => {
    router.replace("/");
  };

  const doLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  if (loading)
    return <Text style={{ textAlign: "center", marginTop: 50 }}>Loading Users...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Panel</Text>

      {/* כפתור חזרה לדף הבית */}
      <TouchableOpacity style={styles.homeButton} onPress={goHome}>
        <Text style={styles.homeButtonText}>← Back to Home</Text>
      </TouchableOpacity>

      {/* כפתור Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={doLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

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
              <View style={styles.btnRow}>
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
  container: { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e63946",
    textAlign: "center",
    marginBottom: 15,
  },

  homeButton: {
    backgroundColor: "#457b9d",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  homeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  logoutButton: {
    backgroundColor: "#e63946",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  logoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
  },
  email: { fontSize: 18, fontWeight: "600" },
  role: { fontSize: 16, marginTop: 5 },
  status: { fontSize: 16, marginTop: 5 },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  approveBtn: {
    backgroundColor: "#2a9d8f",
    padding: 10,
    borderRadius: 10,
    width: "48%",
    alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: "#e63946",
    padding: 10,
    borderRadius: 10,
    width: "48%",
    alignItems: "center",
  },
  adminBtn: {
    backgroundColor: "#1d3557",
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
