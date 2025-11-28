import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);

        const ref = doc(db, "users", authUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setRole(data.role);
          setApproved(data.approved);
        }
      } else {
        setUser(null);
        setRole(null);
        setApproved(null);
      }
      setLoading(false);
    });
  }, []);

  // 🔥 פונקציית Logout אמיתית
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
    setApproved(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, approved, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
