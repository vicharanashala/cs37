"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  footer: ReactNode;
  children: ReactNode;
}

export default function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: AuthCardProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-xl border border-border bg-card p-8">
          <Link href="/" className="flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-background font-bold text-sm">
              S
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Samagama FAQ</h1>
              <p className="text-xs text-muted">Vicharanashala · IIT Ropar</p>
            </div>
          </Link>

          <h2 className="text-xl font-bold mb-1">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted mb-6">{subtitle}</p>
          )}

          {children}

          <div className="mt-6 text-center">{footer}</div>
        </div>
      </motion.div>
    </div>
  );
}