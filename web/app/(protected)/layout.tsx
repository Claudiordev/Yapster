import { RolesSync } from "./_Components/RolesSync";

import { getAccount } from "@/lib/getAccount";
import { AccountProvider } from "@/lib/hooks/useAccount";
import { RealtimeProvider } from "@/lib/hooks/useRealtime";

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
          initialFeatures={account?.features ?? {}}
          initialAvatarUrl={account?.avatarUrl ?? null}
          initialBalance={account?.balance ?? 0}
          initialRoles={account?.roles ?? []}
          initialUserId={account?.userId ?? null}
          initialUsername={account?.username ?? ""}
        >
          <RealtimeProvider>
            <RolesSync />
            {children}
          </RealtimeProvider>
        </AccountProvider>
      </div>
    </div>
  );
}
