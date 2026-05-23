import { useRouter } from "expo-router";
import StatusHoldScreen from "../../components/ui/StatusHoldScreen";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function DoctorPending() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLanguage();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <StatusHoldScreen
      ionIcon="medkit-outline"
      title={t("pending_title_doctor")}
      subtitle={t("pending_subtitle_doctor")}
      message={t("pending_message_doctor")}
      logoutLabel={t("logout")}
      onLogout={handleLogout}
    />
  );
}
