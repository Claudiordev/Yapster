import { Icon } from "@/components/icon";

interface AuthLoadingProps {
  label?: string;
}

// Full-screen branded loader shown during the post-login hard navigation.
export function AuthLoading({ label = "Signing you in…" }: AuthLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <span className="text-brand animate-pulse">
        <Icon name="logo" size={72} />
      </span>
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-default-200/40 border-t-brand" />
      <p className="text-small text-default-500">{label}</p>
    </div>
  );
}
