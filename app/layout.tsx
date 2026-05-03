import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Economics Expert — AI Tutor",
  description:
    "An AI tutor specialized in Economics. Ask questions, take quizzes, and get step-by-step explanations grounded in classic economics texts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-ink-900 text-ink-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
