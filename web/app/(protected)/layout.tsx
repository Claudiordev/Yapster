import { LeftSidebar } from "@/components/left-sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-row h-screen overflow-hidden">
      <LeftSidebar />
      <main className="flex-grow flex flex-col overflow-auto px-6 py-4">
        {children}
      </main>
    </div>
  );
}
