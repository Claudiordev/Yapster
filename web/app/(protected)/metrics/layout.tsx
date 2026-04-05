export default function MetricsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center flex-grow py-4 md:py-6">
      <div className="w-full max-w-6xl flex flex-col flex-grow">
        {children}
      </div>
    </section>
  );
}
