import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
