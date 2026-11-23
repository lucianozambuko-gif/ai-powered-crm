import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { RegisterSW } from "./register-sw";

export const metadata: Metadata = {
  title: "Cloud CRM",
  description: "Tony's personal CRM with an AI assistant",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cloud CRM", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
};

const nav = [
  { href: "/", label: "Assistant" },
  { href: "/contacts", label: "Contacts" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/approvals", label: "Approvals" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <span className="brand">Cloud CRM</span>
          <nav>
            {nav.map((n) => (
              <Link key={n.href} href={n.href}>{n.label}</Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
