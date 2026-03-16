import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatbot Technology Benchmark | OCBC",
  description:
    "Compare NLU-based, Hybrid Gen-AI, and RAG-based chatbot approaches for retirement planning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans antialiased">{children}</body>
    </html>
  );
}
