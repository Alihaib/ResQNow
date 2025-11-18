import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { auth } from "../firebase/config";

// ---- הגדרת סוג הנתונים ----
type AuthContextType = {
  user: User | null;
  loading: boolean;
};

// ---- יצירת הקונטקסט עם טיפוס ----
const AuthContext = createContext<AuthContextType | null>(null);

// ---- פרוביידר ----
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ---- פונקציה לשימוש בקונטקסט ----
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
