// app/admin/panel.tsx
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
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

export default function AdminPanel() {
  const router = useRouter();
  const { role, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();

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

  const approve = async (id: string) => {
    await updateDoc(doc(db, "users", id), { approved: true });
    loadUsers();
  };

  const reject = async (id: string) => {
    await updateDoc(doc(db, "users", id), { approved: false });
    loadUsers();
  };

  const makeAdmin = async (id: string) => {
    await updateDoc(doc(db, "users", id), { role: "admin", approved: true });
    loadUsers();
  };

  const goHome = () => router.replace("/");

  return (
    <SafeAreaView style={styles.container}>

      {/* 🌍 Language Button */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage}>
        <Text style={styles.langText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goHome}>
          <Text style={styles.smallLink}>{t("backHome")}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t("adminPanel")}</Text>

        <TouchableOpacity onPress={logout}>
          <Text style={styles.smallLink}>{t("logout")}</Text>
        </TouchableOpacity>
      </View>

      {/* LOADING */}
      {loading && <Text style={styles.loading}>{t("loadingUsers")}</Text>}

      {/* LIST */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const roleName = t(item.role || "user");
          const roleColor = getRoleColor(item.role);

          const displayRole = (item.role ?? "user").toString().toUpperCase();

          return (
            <View style={styles.card}>
              {/* NAME + ROLE */}
              <View style={styles.row}>
                <View style={styles.userInfo}>
                  <Text style={styles.name}>{item.name || item.email}</Text>
                  {item.name && (
                    <Text style={styles.email}>{item.email}</Text>
                  )}
                </View>

                <View style={[styles.roleTag, { backgroundColor: roleColor }]}>
                  <Text style={styles.roleTagText}>{displayRole}</Text>
                </View>
              </View>

              {/* PHONE NUMBER */}
              {item.phoneNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t("phoneNumber")}:</Text>
                  <Text style={styles.infoValue}>{item.phoneNumber}</Text>
                </View>
              )}

              {/* STATUS */}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{roleName}</Text>

                <Text
                  style={[
                    styles.statusValue,
                    item.approved ? styles.approved : styles.pending,
                  ]}
                >
                  {item.approved ? t("approved") : t("awaitingApproval")}
                </Text>
              </View>

              {/* ACTION BUTTONS */}
              {(item.role === "doctor" || item.role === "ambulance") && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => approve(item.id)}
                  >
                    <Text style={styles.btnText}>{t("approve")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => reject(item.id)}
                  >
                    <Text style={styles.btnText}>{t("reject")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* MAKE ADMIN */}
              {item.role !== "admin" && (
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => makeAdmin(item.id)}
                >
                  <Text style={styles.adminBtnText}>{t("makeAdmin")}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function getRoleColor(role: string | undefined) {
  switch (role) {
    case "doctor":
      return "#0EA5E9";
    case "ambulance":
      return "#F97316";
    case "admin":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  langBtn: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "#003049",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    zIndex: 50,
  },
  langText: {
    color: "white",
    fontWeight: "800",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 40,
    marginBottom: 10,
  },

  smallLink: {
    color: "#D62828",
    fontWeight: "700",
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#003049",
  },

  loading: {
    marginTop: 20,
    textAlign: "center",
    color: "#6C757D",
  },

  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    elevation: 5,
    marginBottom: 15,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
  email: {
    fontSize: 13,
    color: "#6C757D",
    marginTop: 2,
  },
  infoRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    color: "#6C757D",
    fontSize: 13,
  },
  infoValue: {
    color: "#212529",
    fontSize: 13,
    fontWeight: "600",
  },

  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  roleTagText: {
    color: "white",
    fontWeight: "800",
  },

  statusRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statusLabel: {
    color: "#6C757D",
  },

  statusValue: {
    fontWeight: "700",
  },

  approved: { color: "#2D6A4F" },
  pending: { color: "#D62828" },

  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },

  approveBtn: {
    flex: 1,
    backgroundColor: "#2D6A4F",
    padding: 12,
    borderRadius: 12,
    marginRight: 6,
    alignItems: "center",
  },

  rejectBtn: {
    flex: 1,
    backgroundColor: "#D62828",
    padding: 12,
    borderRadius: 12,
    marginLeft: 6,
    alignItems: "center",
  },

  btnText: {
    color: "white",
    fontWeight: "800",
  },

  adminBtn: {
    marginTop: 15,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#003049",
  },
  adminBtnText: {
    color: "white",
    fontWeight: "800",
  },
});
