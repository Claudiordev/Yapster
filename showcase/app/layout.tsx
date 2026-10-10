import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Voxsi: Your crew, one place",
  description:
    "Voxsi brings free 1440p sharing, low-latency voice and video, gaming events, game servers, communities, and generous file sharing together.",
  icons: { icon: "/voxsi-mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#090509",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
