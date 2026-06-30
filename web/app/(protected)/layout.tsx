import { getAccount } from "@/lib/get-account";
import { AccountProvider } from "@/lib/use-account";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getAccount();

  return (
    <div className="relative h-screen overflow-hidden flex flex-col bg-background">
      <div
        aria-hidden
        className="app-backdrop pointer-events-none absolute inset-0"
      />
      <div className="relative z-10 flex flex-col flex-grow min-h-0">
        <AccountProvider
          initialAvatarUrl={account?.avatarUrl ?? null}
          initialBalance={account?.balance ?? 0}
          initialUsername={account?.username ?? ""}
        >
          {children}
        </AccountProvider>
      </div>
    </div>
  );
}
