import { SunsetBackdrop } from "./_Components/sunset-backdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 pt-4 pb-28">
      <SunsetBackdrop />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}
