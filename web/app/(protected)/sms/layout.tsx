export default function SmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col flex-grow text-foreground">
      <div className="w-full flex flex-col flex-grow">{children}</div>
    </section>
  );
}
