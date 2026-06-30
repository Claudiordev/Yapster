export default function SmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col flex-grow min-h-0 text-foreground">
      {children}
    </section>
  );
}
