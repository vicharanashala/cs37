"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import { useAuth } from "@/context/AuthContext";
import { Mail, Shield, Loader2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_PASSCODE = "Vicharanashala-FAQ";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (role === "admin") {
      if (passcode !== ADMIN_PASSCODE) {
        setError("Invalid Admin Passcode");
        setLoading(false);
        return;
      }
      const payload = btoa(
        JSON.stringify({
          userId: "admin",
          email: "admin@vicharanashala.org",
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        })
      );
      const fakeToken = `admin.${payload}.fake`;
      signIn(fakeToken, "admin");
      router.replace("/");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!data || !data.ok) {
        setError(
          data?.error?.message ?? "Sign in failed. Please try again."
        );
        return;
      }

      signIn(data.token, role);
      router.replace("/");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={role === "admin" ? "Admin Access" : "Welcome back"}
      subtitle={role === "admin" ? "Enter the admin passcode to continue" : "Sign in to your account to continue"}
      footer={
        <p className="text-sm text-muted">
          {role === "admin" ? (
            <>Need a user account?{" "}
              <button type="button" onClick={() => setRole("user")} className="text-accent hover:text-accent-hover font-medium">
                Sign in as User
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-accent hover:text-accent-hover font-medium">
                Sign up
              </Link>
            </>
          )}
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">Login as</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setRole("user"); setError(""); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border",
                role === "user"
                  ? "bg-accent text-background border-accent"
                  : "bg-card text-muted border-border hover:text-foreground"
              )}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => { setRole("admin"); setError(""); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border",
                role === "admin"
                  ? "bg-accent text-background border-accent"
                  : "bg-card text-muted border-border hover:text-foreground"
              )}
            >
              Admin
            </button>
          </div>
        </div>

        {role === "user" ? (
          <>
            <AuthInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </>
        ) : (
          <AuthInput
            label="Admin Passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter admin passcode"
            required
          />
        )}

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-sm transition-all",
            !loading
              ? "bg-accent text-background hover:bg-accent-hover shadow-lg shadow-accent/20"
              : "bg-card text-muted border border-border cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {role === "admin" ? "Authenticating…" : "Signing in…"}
            </>
          ) : (
            <>
              {role === "admin" ? <Shield size={16} /> : <Mail size={16} />}
              {role === "admin" ? "Login as Admin" : "Sign In"}
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}