import { AppTopBar } from "@/components/app-top-bar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-grow min-h-0">
      <AppTopBar />
      <section className="flex flex-col items-center flex-grow min-h-0 overflow-y-auto px-6 py-4 md:py-6">
        <div className="w-full max-w-2xl flex flex-col flex-grow">
          {children}
        </div>
      </section>
    </div>
  );
}
