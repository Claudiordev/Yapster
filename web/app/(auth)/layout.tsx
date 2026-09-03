import { RedVoidBackdrop } from "./_Components/red-void-backdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#070507] px-4 py-10">
      <RedVoidBackdrop />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}
