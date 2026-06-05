"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import { useAuth } from "@/context/AuthContext";
import { Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!data || !data.ok) {
        setError(
          data?.error?.message ?? "Sign up failed. Please try again."
        );
        return;
      }

      signUp(data.token);
      router.replace("/");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create account"
      subtitle="Join the Samagama FAQ community"
      footer={
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-accent hover:text-accent-hover font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
        />

        <AuthInput
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
        />

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
              Creating account…
            </>
          ) : (
            <>
              <Lock size={16} />
              Create Account
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}