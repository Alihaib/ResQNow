import { useRouter } from "expo-router";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
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

  const approveUser = async (id: string, r: string) => {
    await updateDoc(doc(db, "users", id), { approved: true });

    const message =
      r === "doctor"
        ? "Doctor Approved! ✅"
        : r === "ambulance"
        ? "Ambulance Approved! 🚑"
        : "User Approved ✔";

    alert(message);
    loadUsers();
  };

  const rejectUser = async (id: string, r: string) => {
    await updateDoc(doc(db, "users", id), { approved: false });

    const message =
      r === "doctor"
        ? "Doctor Rejected ❌"
        : r === "ambulance"
        ? "Ambulance Rejected ❌"
        : "User Rejected";

    alert(message);
    loadUsers();
  };

  const makeAdmin = async (id: string) => {
    await updateDoc(doc(db, "users", id), { role: "admin", approved: true });
    alert("User is now an Admin! ⭐");
    loadUsers();
  };

  const goHome = () => router.replace("/");

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.header}>Admin Panel</Text>

        {/* Back to home */}
        <TouchableOpacity style={styles.backHomeBtn} onPress={goHome}>
          <Text style={styles.backHomeText}>← Back to Home</Text>
        </TouchableOpacity>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.role}>Role: {item.role}</Text>

              <Text style={styles.status}>
                Status:{" "}
                {item.approved
                  ? item.role === "doctor"
                    ? "Doctor Approved ✔"
                    : item.role === "ambulance"
                    ? "Ambulance Approved ✔"
                    : "Approved ✔"
                  : "Not Approved ❌"}
              </Text>

              {item.role !== "admin" && (
                <>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => approveUser(item.id, item.role)}
                    >
                      <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => rejectUser(item.id, item.role)}
                    >
                      <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.adminBtn}
                    onPress={() => makeAdmin(item.id)}
                  >
                    <Text style={styles.btnText}>Make Admin</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        />

        {/* Logout ALWAYS visible at bottom, safe for iPhone 15 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e63946",
    marginBottom: 20,
    textAlign: "center",
  },

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

  logoutBtn: {
    backgroundColor: "#e63946",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
  },

  logoutText: { color: "white", fontSize: 18, fontWeight: "700" },

  loadingPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: { fontSize: 18, color: "#333" },
});
