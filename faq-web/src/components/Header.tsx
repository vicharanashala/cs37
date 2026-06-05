"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageCircle, HelpCircle, Menu, X, MessageSquare, Shield, User } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/", label: "FAQ", icon: HelpCircle },
  { href: "/ask", label: "Ask", icon: MessageCircle },
  // { href: "/threads", label: "Threads", icon: MessageSquare },
  { href: "/community", label: "Community", icon: User },
  { href: "/admin", label: "Admin", icon: Shield },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render auth-dependent UI on the client to avoid SSR/client mismatch.
  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-background font-bold text-sm">
              S
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold leading-tight">
                Samagama FAQ
              </h1>
              <p className="text-xs text-muted">
                Vicharanashala · IIT Ropar
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-card"
                  )}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Version Badge */}
          <div className="hidden md:flex items-center gap-3">
            {mounted && user ? (
              <button
                onClick={() => router.push("/resolve")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-card-hover transition-colors"
              >
                  <div className="h-6 w-6 rounded-full bg-accent text-background flex items-center justify-center text-xs font-bold">
                    {user.email[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-muted max-w-32 truncate">{user.email}</span>
                </button>
            ) : (
              <span className="text-xs text-muted bg-card px-2.5 py-1 rounded-full border border-border">
                v2.0.0
              </span>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-card transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <nav className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground hover:bg-card"
                    )}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
