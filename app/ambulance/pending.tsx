import { useRouter } from "expo-router";
import StatusHoldScreen from "../../components/ui/StatusHoldScreen";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function AmbulancePending() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLanguage();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <StatusHoldScreen
      ionIcon="car-outline"
      title={t("pending_title_ambulance")}
      subtitle={t("pending_subtitle_ambulance")}
      message={t("pending_message_ambulance")}
      logoutLabel={t("logout")}
      onLogout={handleLogout}
    />
  );
}
