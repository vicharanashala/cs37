/**
 * src/context/AuthContext.tsx
 *
 * Provides auth state (user, token, signIn, signUp, signOut) globally.
 * Initialises from localStorage on mount so the session survives page reloads.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { clearAuthToken, getAuthToken, setAuthToken, clearAuthRole, getAuthRole, setAuthRole } from "@/lib/auth";
import type { JwtPayload } from "@/lib/jwt";

/**
 * Browser-safe JWT payload decoder.
 * Does NOT verify the signature — that is the server's responsibility.
 * We only need to read userId/email to hydrate UI state.
 */
function decodeToken(token: string): JwtPayload | null {
  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return null;
    // atob requires standard base64; JWT uses base64url, so fix padding/chars
    const json = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as JwtPayload & { exp?: number };
    // Reject if token is already expired
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (!payload.userId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

interface AuthUser {
  userId: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  role: "user" | "admin" | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, role: "user" | "admin") => void;
  signUp: (token: string, role: "user" | "admin") => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialState(): AuthState {
  const stored = getAuthToken();
  if (stored) {
    const payload = decodeToken(stored);
    if (payload) {
      return {
        user: { userId: payload.userId, email: payload.email },
        token: stored,
        role: getAuthRole(),
        loading: false,
      };
    }
    clearAuthToken();
  }
  return { user: null, token: null, role: null, loading: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitialState);

  const signIn = useCallback((newToken: string, role: "user" | "admin") => {
    const payload = decodeToken(newToken);
    if (!payload) return;
    setAuthToken(newToken);
    setAuthRole(role);
    setState({
      user: { userId: payload.userId, email: payload.email },
      token: newToken,
      role,
      loading: false,
    });
  }, []);

  const signUp = useCallback((newToken: string, role: "user" | "admin") => {
    const payload = decodeToken(newToken);
    if (!payload) return;
    setAuthToken(newToken);
    setAuthRole(role);
    setState({
      user: { userId: payload.userId, email: payload.email },
      token: newToken,
      role,
      loading: false,
    });
  }, []);

  const signOut = useCallback(() => {
    clearAuthToken();
    clearAuthRole();
    setState({ user: null, token: null, role: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}