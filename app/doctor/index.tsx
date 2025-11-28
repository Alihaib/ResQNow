import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../src/context/AuthContext";

export default function DoctorIndex() {
  const { approved } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (approved === false) {
      router.replace("/doctor/pending");
    } else if (approved === true) {
      router.replace("/doctor/dashboard");
    }
  }, [approved]);

  return null;
}
