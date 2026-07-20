import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { appLogin, appMe } from "@/lib/api";

const TOKEN_KEY = "nexopro_app_token";
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

const AppAuthContext = createContext(null);
export const useAppAuth = () => useContext(AppAuthContext);

export function AppAuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = comprobando, false = sin sesión, objeto = autenticado
  const timer = useRef(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  }, []);

  const armInactivity = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { logout(); }, INACTIVITY_MS);
  }, [logout]);

  const login = useCallback(async (email, password, totp_code) => {
    const r = await appLogin(email, password, totp_code);
    if (r.requires_2fa) return { requires_2fa: true };
    localStorage.setItem(TOKEN_KEY, r.token);
    setUser({ ...r.user, must_change_password: r.must_change_password });
    armInactivity();
    return { ok: true, user: r.user };
  }, [armInactivity]);

  const refresh = useCallback(async () => {
    try { const me = await appMe(); setUser(me); } catch { logout(); }
  }, [logout]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setUser(false); return; }
    appMe().then(setUser).catch(() => logout());
  }, [logout]);

  // Auto-logout por inactividad
  useEffect(() => {
    if (!user) return;
    armInactivity();
    const evs = ["mousedown", "keydown", "scroll", "touchstart"];
    const reset = () => armInactivity();
    evs.forEach((e) => window.addEventListener(e, reset));
    return () => { evs.forEach((e) => window.removeEventListener(e, reset)); if (timer.current) clearTimeout(timer.current); };
  }, [user, armInactivity]);

  return (
    <AppAuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AppAuthContext.Provider>
  );
}
