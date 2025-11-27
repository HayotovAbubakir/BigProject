/* eslint-disable react-refresh/only-export-components */
import React from "react";

const AUTH_KEY = "app_auth_v1";
const CREDENTIALS_KEY = "app_credentials_v1";
// Built-in users and their fixed passwords (fallback/default)
const ALLOWED_USERS = {
  habibjon: "0000",
  hamdamjon: "1010",
};
const HOUR_MS = 60 * 60 * 1000;

const AuthContext = React.createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [showLogin, setShowLogin] = React.useState(false);
  const [credentials, setCredentials] = React.useState(() => {
    try {
      const raw = localStorage.getItem(CREDENTIALS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...ALLOWED_USERS, ...parsed };
    } catch (err) {
      return { ...ALLOWED_USERS };
    }
  });

  // load auth from storage
  React.useEffect(() => {
    // Try to load auth from sessionStorage so modal isn't shown on every refresh.
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // check expiry and that the user exists in current credentials
        if (
          parsed &&
          parsed.username &&
          parsed.ts &&
          Date.now() - parsed.ts < HOUR_MS &&
          Object.prototype.hasOwnProperty.call(credentials, parsed.username)
        ) {
          setUser({ username: parsed.username, ts: parsed.ts });
          setShowLogin(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    setShowLogin(true);
  }, [credentials]);

  // schedule re-auth every hour
  React.useEffect(() => {
    if (!user) return;
    const remaining = HOUR_MS - (Date.now() - user.ts);
    const t = setTimeout(
      () => setShowLogin(true),
      remaining > 0 ? remaining : 0
    );
    return () => clearTimeout(t);
  }, [user]);

  const login = ({ username, password }) => {
    const userKey = (username || "").toString();
    // check dynamic credentials first (includes built-ins)
    if (!Object.prototype.hasOwnProperty.call(credentials, userKey))
      return { ok: false };
    if (String(password) !== String(credentials[userKey])) return { ok: false };
    const auth = { username: userKey, ts: Date.now() };
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch {
      /* ignore */
    }
    setUser(auth);
    setShowLogin(false);
    return { ok: true };
  };

  const registerUser = (username, password) => {
    if (!username) return false;
    const uname = username.toString();
    const pwd = String(password || "");
    try {
      const existingRaw = localStorage.getItem(CREDENTIALS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      existing[uname] = pwd;
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(existing));
      setCredentials((prev) => ({ ...prev, [uname]: pwd }));
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    setShowLogin(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        showLogin,
        setShowLogin,
        registerUser,
        credentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export default AuthContext;
