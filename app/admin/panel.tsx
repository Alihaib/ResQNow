// app/admin/panel.tsx
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { theme } from "../../src/ui/theme";

export default function AdminPanel() {
  const router = useRouter();
  const { role, loading: authLoading, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    // Prevent redirect flicker/loops while role is still null during auth bootstrap.
    if (role !== "admin") {
      router.replace("/");
      return;
    }

    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      loadUsers();
    }
  }, [authLoading, role, router]);

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
    const nameForConfirm = userName || t("deleteThisUser");
    Alert.alert(
      t("deleteAccount"),
      t("deleteUserConfirm").replace("{name}", nameForConfirm),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", id));
              loadUsers();
            } catch (error) {
              console.error("Error deleting user:", error);
              Alert.alert(t("error"), t("error"));
            }
          },
        },
      ]
    );
  };

  const goBack = () => {
    // Prefer actual back navigation (when admin came from tabs),
    // but always provide a safe exit path to avoid loops.
    // `canGoBack` may not exist in older expo-router versions, so guard it.
    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Calculate statistics
  const stats = useMemo(
    () => ({
      total: users.length,
      approved: users.filter((u) => u.approved).length,
      pending: users.filter((u) => !u.approved && (u.role === "doctor" || u.role === "ambulance")).length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [users]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 🌍 Language Button */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage}>
        <Text style={styles.langText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityRole="button">
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>{t("adminPanel")}</Text>
            <View style={styles.titlePill}>
              <Text style={styles.titlePillText}>{t("manageUsers")}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STATISTICS CARDS */}
      {!loading && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t("users") || t("cases")}</Text>
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
              <Text style={styles.emptyText}>{t("noUsersFound")}</Text>
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
                  <View style={[styles.roleTag, { borderColor: roleColor }]}>
                    <Text style={[styles.roleTagText, { color: roleColor }]}>{roleName.toUpperCase()}</Text>
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

                {/* ACTION BUTTONS ROW */}
                <View style={styles.actionButtonsRow}>
                  {/* MAKE ADMIN */}
                  {item.role !== "admin" && (
                    <TouchableOpacity
                      style={styles.adminBtn}
                      onPress={() => makeAdmin(item.id)}
                    >
                      <Text style={styles.adminBtnText}>{t("makeAdmin")}</Text>
                    </TouchableOpacity>
                  )}

                  {/* DELETE USER */}
                  <TouchableOpacity
                    style={styles.deleteUserBtn}
                    onPress={() => deleteUser(item.id, item.name || item.email)}
                  >
                    <Text style={styles.deleteBtnText}>{t("delete")}</Text>
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
    backgroundColor: theme.colors.bg,
  },

  langBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 50,
    ...theme.shadow.card,
  },
  langText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 14,
  },

  header: {
    backgroundColor: theme.colors.surface,
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: "700",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 999,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 13,
  },
  titlePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titlePillText: {
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },

  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  statCardSuccess: {
    backgroundColor: "#ECFDF5",
  },
  statCardWarning: {
    backgroundColor: "#FFFBEB",
  },
  statCardDanger: {
    backgroundColor: "#FEF2F2",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
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
    color: theme.colors.surface,
    fontSize: 20,
    fontWeight: "900",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  roleTagText: {
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
    backgroundColor: "#ECFDF5",
  },
  statusBadgePending: {
    backgroundColor: "#FEF2F2",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusTextSuccess: {
    color: "#166534",
  },
  statusTextPending: {
    color: "#B91C1C",
  },

  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.primary,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.primary,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  adminBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  adminBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  deleteUserBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    ...theme.shadow.card,
  },
  deleteBtnText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "900",
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
