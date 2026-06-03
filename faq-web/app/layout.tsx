import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Samagama FAQ Portal | Vicharanashala Internship - IIT Ropar",
  description:
    "AI-powered FAQ portal for the Vicharanashala Internship Programme at IIT Ropar. Search, ask, and get instant answers.",
  keywords: [
    "Samagama",
    "FAQ",
    "Vicharanashala",
    "IIT Ropar",
    "Internship",
    "VINS",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
     <body
  className={`${geistSans.variable} ${geistMono.variable} antialiased`}
  suppressHydrationWarning
>
        <ThemeProvider>
           {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#141414",
              color: "#ededed",
              border: "1px solid #2a2a2a",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
            },
            success: {
              iconTheme: {
                primary: "#22c55e",
                secondary: "#141414",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#141414",
              },
            },
          }}
        />
        </ThemeProvider>
       
      </body>
    </html>
  );
}
