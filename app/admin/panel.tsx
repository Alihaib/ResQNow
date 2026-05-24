// app/admin/panel.tsx
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUiDirection } from "../../components/ui/layout";
import ScreenHeader from "../../components/ui/ScreenHeader";
import EmptyState from "../../components/ui/EmptyState";
import { cardShadow, tokens } from "../../src/ui/tokens";

import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
export default function AdminPanel() {
  const router = useRouter();
  const { role, loading: authLoading, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const { row, marginHorizontal } = useUiDirection();

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
    <View style={styles.container}>
      <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage}>
        <Text style={styles.langText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <ScreenHeader
        title={t("adminPanel")}
        eyebrow={t("manageUsers")}
        onBack={goBack}
        fallbackRoute="/(tabs)"
        trailing={
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>
        }
      />

      {/* STATISTICS CARDS */}
      {!loading && (
        <View style={[styles.statsContainer, row]}>
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
            <EmptyState ionIcon="people-outline" title={t("noUsersFound")} />
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
                <View style={[styles.cardHeader, row]}>
                  <View
                    style={[
                      styles.avatar,
                      marginHorizontal(0, 12),
                      { backgroundColor: roleColor },
                    ]}
                  >
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.name || item.email}</Text>
                    {item.name && (
                      <Text style={styles.email}>{item.email}</Text>
                    )}
                    {item.phoneNumber && (
                      <Text style={styles.phone}>{item.phoneNumber}</Text>
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
                      {item.approved ? t("approved") : t("awaitingApproval")}
                    </Text>
                  </View>
                </View>

                {/* ACTION BUTTONS */}
                {(item.role === "doctor" || item.role === "ambulance") && !item.approved && (
                  <View style={[styles.btnRow, row]}>
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
                <View style={[styles.actionButtonsRow, row]}>
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
    </View>
  );
}

function getRoleColor(role: string | undefined) {
  switch (role) {
    case "doctor":
      return tokens.color.primary;
    case "ambulance":
      return tokens.color.warning;
    case "admin":
      return tokens.color.danger;
    default:
      return tokens.color.textMuted;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  langBtn: {
    position: "absolute",
    top: 12,
    end: 12,
    backgroundColor: tokens.color.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.border,
    zIndex: 50,
    ...cardShadow,
  },
  langText: {
    color: tokens.color.textPrimary,
    fontWeight: "900",
    fontSize: 14,
  },

  header: {
    backgroundColor: tokens.color.bgSurface,
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: tokens.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  headerTop: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.bgPage,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: tokens.color.textPrimary,
    fontWeight: "700",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 999,
    backgroundColor: tokens.color.bgPage,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: tokens.color.textPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
  titlePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tokens.color.bgPage,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  titlePillText: {
    color: tokens.color.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },

  statsContainer: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.sm,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.color.border,
    ...cardShadow,
  },
  statCardSuccess: {
    backgroundColor: tokens.color.successBg,
  },
  statCardWarning: {
    backgroundColor: tokens.color.warningBg,
  },
  statCardDanger: {
    backgroundColor: tokens.color.dangerBg,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.color.textMuted,
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
    color: tokens.color.textMuted,
    fontWeight: "600",
  },

  listContent: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.xl,
  },

  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    marginBottom: tokens.space.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    ...cardShadow,
  },

  cardHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: tokens.color.bgSurface,
    fontSize: 20,
    fontWeight: "900",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: tokens.color.textMuted,
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: tokens.color.textMuted,
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
    backgroundColor: tokens.color.successBg,
  },
  statusBadgePending: {
    backgroundColor: tokens.color.dangerBg,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusTextSuccess: {
    color: tokens.color.successText,
  },
  statusTextPending: {
    color: tokens.color.dangerDark,
  },

  btnRow: {
    gap: 10,
    marginBottom: tokens.space.sm,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: tokens.color.success,
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: tokens.color.danger,
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: tokens.color.bgSurface,
    fontSize: 14,
    fontWeight: "900",
  },

  actionButtonsRow: {
    gap: 10,
    marginTop: 4,
  },
  adminBtn: {
    flex: 1,
    backgroundColor: tokens.color.bgSurface,
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.border,
    ...cardShadow,
  },
  adminBtnText: {
    color: tokens.color.textPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  deleteUserBtn: {
    flex: 1,
    backgroundColor: tokens.color.bgSurface,
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.dangerBorder,
    ...cardShadow,
  },
  deleteBtnText: {
    color: tokens.color.dangerDark,
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
    color: tokens.color.textMuted,
    fontWeight: "600",
  },
});
