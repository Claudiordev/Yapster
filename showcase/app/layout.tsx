import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Voxsi - Play together, win prizes!",
  description:
    "Voxsi is in closed beta. Join live gaming events and tournaments for a chance to win cash prizes. Bring your crew together with free 1080p screen sharing, voice chat, and community servers.",
  icons: {
    icon: [
      { url: "/voxsi-favicon-v3-16.png", type: "image/png", sizes: "16x16" },
      { url: "/voxsi-favicon-v3-32.png", type: "image/png", sizes: "32x32" },
      { url: "/voxsi-favicon-v3-48.png", type: "image/png", sizes: "48x48" },
      { url: "/voxsi-favicon-v3.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/voxsi-favicon-v3.ico",
    apple: { url: "/voxsi-apple-icon-v3.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#090509",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
