import { AppTopBar } from "@/components/app-top-bar";

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-grow min-h-0">
      <AppTopBar />
      <section className="flex flex-col items-center justify-center flex-grow min-h-0 overflow-y-auto gap-4 px-6 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center justify-center">
          {children}
        </div>
      </section>
    </div>
  );
}
