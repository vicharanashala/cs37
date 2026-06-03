"use client";
import { Sun, Moon } from "lucide-react";  // add Sun, Moon to existing lucide import
import { useTheme } from "./ThemeProvider";
import NotificationBell from "./NotificationBell";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageCircle, HelpCircle, CheckCircle, Menu, X, MessageSquare, User } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/", label: "FAQ", icon: HelpCircle },
  { href: "/ask", label: "Ask", icon: MessageCircle },
  // { href: "/threads", label: "Threads", icon: MessageSquare },
  { href: "/community", label: "Community", icon: User },
  { href: "/resolve", label: "Resolve", icon: CheckCircle },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
          {/* Right side actions */}
<div className="flex items-center gap-2">
  <NotificationBell />

  <button
    onClick={toggleTheme}
    className="p-2 rounded-lg hover:bg-card transition-colors"
    aria-label="Toggle theme"
  >
    <AnimatePresence mode="wait" initial={false}>
      {theme === "dark" ? (
        <motion.span
          key="sun"
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Sun size={18} className="text-muted" />
        </motion.span>
      ) : (
        <motion.span
          key="moon"
          initial={{ rotate: 90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: -90, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Moon size={18} className="text-muted" />
        </motion.span>
      )}
    </AnimatePresence>
  </button>

  <span className="hidden md:inline-flex text-xs text-muted bg-card px-2.5 py-1 rounded-full border border-border">
    v2.0.0
  </span>

  {/* Mobile Menu Button stays here */}
  <button
    onClick={() => setMobileOpen(!mobileOpen)}
    className="md:hidden p-2 rounded-lg hover:bg-card transition-colors"
    aria-label="Toggle menu"
  >
    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
  </button>
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
