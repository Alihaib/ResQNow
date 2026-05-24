import { useRouter, useSegments } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../src/context/AuthContext";

/**
 * Redirects unauthenticated users away from protected routes.
 * Public: landing (`/`) and `/auth/*`.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) return;

    const first = segments[0];
    const isPublic = first === undefined || first === "auth";
    if (!isPublic) {
      router.replace("/auth/login");
    }
  }, [user, loading, segments, router]);

  return <>{children}</>;
}
