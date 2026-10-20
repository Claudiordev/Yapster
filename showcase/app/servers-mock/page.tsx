import type { Metadata } from "next";

import { ServersMock } from "@/components/servers-mock";

import "@/styles/servers-mock.css";

export const metadata: Metadata = {
  title: "Voxsi: Servers mock",
  description: "Interactive UI mock of community servers.",
  robots: { index: false },
};

export default function ServersMockPage() {
  return <ServersMock />;
}
