// app/admin/panel.tsx
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
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

  const deleteUser = async (id: string, userName: string) => {
    Alert.alert(
      t("deleteAccount"),
      `Are you sure you want to delete ${userName || "this user"}? This action cannot be undone.`,
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", id));
              loadUsers();
            } catch (error) {
              console.error("Error deleting user:", error);
              Alert.alert(t("error"), "Failed to delete user");
            }
          },
        },
      ]
    );
  };

  const goHome = () => {
    router.dismissAll();
    router.replace("/(tabs)");
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.dismissAll();
      router.replace("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Calculate statistics
  const stats = {
    total: users.length,
    approved: users.filter((u) => u.approved).length,
    pending: users.filter((u) => !u.approved && (u.role === "doctor" || u.role === "ambulance")).length,
    admins: users.filter((u) => u.role === "admin").length,
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 🌍 Language Button */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage}>
        <Text style={styles.langText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={goHome}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerIcon}>🔧</Text>
            <Text style={styles.title}>{t("adminPanel")}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STATISTICS CARDS */}
      {!loading && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t("cases")}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardSuccess]}>
            <Text style={styles.statNumber}>{stats.approved}</Text>
            <Text style={styles.statLabel}>{t("approved")}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWarning]}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{t("awaitingApproval")}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardDanger]}>
            <Text style={styles.statNumber}>{stats.admins}</Text>
            <Text style={styles.statLabel}>{t("admin_role")}</Text>
          </View>
        </View>
      )}

      {/* LOADING */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t("loadingUsers")}</Text>
        </View>
      )}

      {/* LIST */}
      {!loading && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const roleName = t(item.role || "user");
            const roleColor = getRoleColor(item.role);
            const initials = (item.name || item.email || "U")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <View style={styles.card}>
                {/* USER AVATAR & INFO */}
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: roleColor }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.name || item.email}</Text>
                    {item.name && (
                      <Text style={styles.email}>{item.email}</Text>
                    )}
                    {item.phoneNumber && (
                      <Text style={styles.phone}>📞 {item.phoneNumber}</Text>
                    )}
                  </View>
                  <View style={[styles.roleTag, { backgroundColor: roleColor }]}>
                    <Text style={styles.roleTagText}>
                      {roleName.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* STATUS BADGE */}
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      item.approved ? styles.statusBadgeSuccess : styles.statusBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.approved ? styles.statusTextSuccess : styles.statusTextPending,
                      ]}
                    >
                      {item.approved ? "✓ " + t("approved") : "⏳ " + t("awaitingApproval")}
                    </Text>
                  </View>
                </View>

                {/* ACTION BUTTONS */}
                {(item.role === "doctor" || item.role === "ambulance") && !item.approved && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => approve(item.id)}
                    >
                      <Text style={styles.approveIcon}>✓</Text>
                      <Text style={styles.btnText}>{t("approve")}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => reject(item.id)}
                    >
                      <Text style={styles.rejectIcon}>✕</Text>
                      <Text style={styles.btnText}>{t("reject")}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ACTION BUTTONS ROW */}
                <View style={styles.actionButtonsRow}>
                  {/* MAKE ADMIN */}
                  {item.role !== "admin" && (
                    <TouchableOpacity
                      style={styles.adminBtn}
                      onPress={() => makeAdmin(item.id)}
                    >
                      <Text style={styles.adminIcon}>👑</Text>
                      <Text style={styles.adminBtnText}>{t("makeAdmin")}</Text>
                    </TouchableOpacity>
                  )}

                  {/* DELETE USER */}
                  <TouchableOpacity
                    style={styles.deleteUserBtn}
                    onPress={() => deleteUser(item.id, item.name || item.email)}
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
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
  },

  langBtn: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "#003049",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  langText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  header: {
    backgroundColor: "#FFFFFF",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: "#003049",
    fontWeight: "700",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  headerIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#003049",
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutIcon: {
    fontSize: 20,
  },

  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardSuccess: {
    backgroundColor: "#D1FAE5",
  },
  statCardWarning: {
    backgroundColor: "#FEF3C7",
  },
  statCardDanger: {
    backgroundColor: "#FEE2E2",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#6C757D",
    fontWeight: "600",
    textAlign: "center",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: "#6C757D",
    fontWeight: "600",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "500",
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleTagText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  statusContainer: {
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeSuccess: {
    backgroundColor: "#D1FAE5",
  },
  statusBadgePending: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusTextSuccess: {
    color: "#2D6A4F",
  },
  statusTextPending: {
    color: "#DC2626",
  },

  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#2D6A4F",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  approveIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  adminBtn: {
    flex: 1,
    backgroundColor: "#003049",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#003049",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  adminIcon: {
    fontSize: 18,
  },
  adminBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteUserBtn: {
    flex: 1,
    backgroundColor: "#991B1B",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#991B1B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: "#6C757D",
    fontWeight: "600",
  },
});
