import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Lakepointe Listening",
  description:
    "Internal brand & name monitoring — mentions of Lakepointe Church and Josh Howerton across news, Reddit, YouTube, and web search.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="relative z-10">
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
