import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Clubstream",
  description: "Streaming match management"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </body>
    </html>
  );
}
