import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusChip from "../../components/ui/StatusChip";
import { useAuth } from "../../src/context/AuthContext";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import type {
  ActivityFeedGroup,
  ActivityFeedItem,
} from "../../src/hooks/useEmergencyActivityFeed";
import { useEmergencyActivityFeed } from "../../src/hooks/useEmergencyActivityFeed";
import { tokens } from "../../src/ui/tokens";
import { theme } from "../../src/ui/theme";
import { caseIdSuffix } from "../../src/utils/formatCaseId";

type ChipVariant = "danger" | "warning" | "success" | "info" | "neutral";

function chipVariantForEvent(eventType: string): ChipVariant {
  switch (eventType) {
    case "cancelled":
    case "dispatch_exhausted":
      return "danger";
    case "arrived":
    case "completed":
      return "success";
    case "enRoute":
    case "dispatched":
      return "info";
    case "rejected":
    case "ambulance_released":
      return "warning";
    default:
      return "neutral";
  }
}

export default function HomeTab() {
  const { user, role, approved } = useAuth();
  const { isEmergencyActive, navigateToActiveEmergency } = useEmergency();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { groups, loading, error } = useEmergencyActivityFeed(
    user?.uid,
    role,
    approved,
    20,
  );

  /**
   * Local expand/collapse state keyed by `emergencyId`. We deliberately don't
   * derive this from the feed itself — collapsing is a UI concern only and
   * must survive realtime snapshot updates (the listener can fire many times
   * a second when a case is moving through its lifecycle).
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = useCallback((emergencyId: string) => {
    setExpanded((prev) => ({ ...prev, [emergencyId]: !prev[emergencyId] }));
  }, []);

  const formatActivityTime = (iso: string) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(lang === "he" ? "he-IL" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activityLabel = (eventType: string) => {
    const key = `activityEvent_${eventType}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const human = eventType.replace(/_/g, " ");
    return t("activityEvent_unknown", human);
  };

  const renderTimelineEvent = (item: ActivityFeedItem, index: number) => (
    <View
      key={item.id}
      style={[
        styles.eventRow,
        index !== 0 && styles.eventRowDivider,
      ]}
    >
      <View style={styles.eventTopRow}>
        <StatusChip
          label={activityLabel(item.eventType)}
          variant={chipVariantForEvent(item.eventType)}
          size="sm"
        />
        <Text style={styles.eventTime}>{formatActivityTime(item.timestampIso)}</Text>
      </View>
      {item.noteText ? (
        <Text style={styles.eventNote} numberOfLines={3}>
          {item.noteText}
        </Text>
      ) : null}
    </View>
  );

  const renderGroup = (group: ActivityFeedGroup) => {
    const isExpanded = !!expanded[group.emergencyId];
    const latest = group.events[0];
    const eventCount = group.events.length;
    return (
      <Card key={group.emergencyId} style={styles.groupCard}>
        <TouchableOpacity
          onPress={() => toggleExpanded(group.emergencyId)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={t("activityEmergencyRef", "Case {id}").replace(
            "{id}",
            caseIdSuffix(group.emergencyId),
          )}
          style={styles.groupHeader}
        >
          <View style={styles.groupHeaderTop}>
            <StatusChip
              label={activityLabel(latest.eventType)}
              variant={chipVariantForEvent(latest.eventType)}
              size="sm"
            />
            <Text style={styles.groupTime}>
              {formatActivityTime(latest.timestampIso)}
            </Text>
          </View>
          <View style={styles.groupHeaderBottom}>
            <Text style={styles.groupCaseId} selectable numberOfLines={1}>
              {t("activityEmergencyRef", "Case {id}").replace(
                "{id}",
                caseIdSuffix(group.emergencyId),
              )}
            </Text>
            <View style={styles.groupHeaderRight}>
              <Text style={styles.groupEventCount}>
                {t("activityEventCount", "{n} events").replace(
                  "{n}",
                  String(eventCount),
                )}
              </Text>
              <Text
                style={styles.groupChevron}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {isExpanded ? "▾" : "▸"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && eventCount > 0 ? (
          <View style={styles.groupBody}>
            {group.events.map(renderTimelineEvent)}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.title}>ResQNow</Text>
        <Text style={styles.subtitle}>{t("home_subtitle")}</Text>
      </View>

      {/* Global emergency state indicator (home) */}
      {isEmergencyActive && (
        <View style={styles.emergencyStatusCard}>
          <Text style={styles.emergencyStatusTitle}>{t("emergencyActiveTitle")}</Text>
          <Text style={styles.emergencyStatusSubtitle}>
            {t("continueActiveEmergencyHint")}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("quickActions")}</Text>

        {/* Emergency Button */}
        <TouchableOpacity
          style={[styles.emergencyBtn, isEmergencyActive && styles.emergencyBtnActive]}
          onPress={() =>
            isEmergencyActive
              ? navigateToActiveEmergency()
              : router.push("/(tabs)/emergency")
          }
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>
            {isEmergencyActive ? t("emergencyActiveShort") : `🚨 ${t("sos")}`}
          </Text>
          <Text style={styles.emergencySubtext}>
            {isEmergencyActive ? t("tapToViewActiveEmergency") : t("tapForHelp")}
          </Text>
        </TouchableOpacity>

        {/* Quick Access Cards */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/(tabs)/firstaid")}
          >
            <Text style={styles.quickIcon}>⛑</Text>
            <Text style={styles.quickText}>{t("firstAid")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.quickIcon}>📋</Text>
            <Text style={styles.quickText}>{t("medicalProfile")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role-Specific Sections */}
      {role === "doctor" && approved && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/doctor/dashboard")}
          >
            <Text style={styles.roleIcon}>👨‍⚕️</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("doctor_dashboard")}</Text>
              <Text style={styles.roleSubtitle}>{t("manageCases")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {role === "ambulance" && approved && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/ambulance/dashboard")}
          >
            <Text style={styles.roleIcon}>🚑</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("ambulance_dashboard")}</Text>
              <Text style={styles.roleSubtitle}>{t("viewLiveCalls")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {role === "admin" && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/admin/panel")}
          >
            <Text style={styles.roleIcon}>🔧</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("admin_panel")}</Text>
              <Text style={styles.roleSubtitle}>{t("manageUsers")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Activity — grouped per emergency, expandable. Live via onSnapshot. */}
      <View style={styles.section}>
        <SectionHeader
          overline={t("activityFeedOverline", "Live")}
          title={t("recentActivity")}
          accent={tokens.color.info}
        />
        {loading ? (
          <EmptyState loading title={t("activityLoading", "Loading activity…")} />
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title={t("activityLoadError", "Could not load activity.")}
            subtitle={t("activitySubtext")}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t("noRecentActivity")}
            subtitle={t("activitySubtext")}
          />
        ) : (
          <View style={styles.activityList}>{groups.map(renderGroup)}</View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xxl,
  },
  logo: {
    fontSize: 60,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  emergencyStatusCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: "#FFF5F5",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.danger,
  },
  emergencyStatusTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.danger,
    marginBottom: 4,
  },
  emergencyStatusSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  emergencyBtn: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    ...theme.shadow.primary,
  },
  emergencyBtnActive: {
    backgroundColor: theme.colors.dangerDark,
  },
  emergencyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  emergencyText: {
    color: theme.colors.surface,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  emergencySubtext: {
    color: theme.colors.surface,
    fontSize: 14,
    opacity: 0.9,
  },
  quickAccessRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: "center",
    ...theme.shadow.card,
  },
  quickIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  roleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    ...theme.shadow.card,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: theme.spacing.lg,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  // ---- Recent Activity (per-emergency group) ---------------------------
  activityList: {
    gap: tokens.space.sm,
  },
  groupCard: {
    marginBottom: 0,
  },
  groupHeader: {
    gap: tokens.space.sm,
  },
  groupHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  groupHeaderBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  groupHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.sm,
    flexShrink: 0,
  },
  groupTime: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
    flexShrink: 0,
  },
  groupCaseId: {
    flexShrink: 1,
    fontSize: tokens.font.body,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    fontFamily: "monospace",
  },
  groupEventCount: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  groupChevron: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textFaint,
    fontWeight: "800",
    minWidth: 14,
    textAlign: "center",
  },
  groupBody: {
    marginTop: tokens.space.md,
    paddingTop: tokens.space.md,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  eventRow: {
    paddingVertical: tokens.space.sm,
  },
  eventRowDivider: {
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  eventTime: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
    flexShrink: 0,
  },
  eventNote: {
    marginTop: tokens.space.xs,
    fontSize: tokens.font.body,
    color: tokens.color.textSecondary,
    fontWeight: "600",
  },
});
