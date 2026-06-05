"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div>
        <label className="block text-sm font-medium mb-2">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "w-full bg-card border rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors placeholder:text-muted",
              error
                ? "border-danger focus:border-danger"
                : "border-border focus:border-accent",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-2 text-xs text-danger flex items-center gap-1">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";

export default AuthInput;