import { ProviderCard } from "@/features/home/components/ProviderCard";

export interface AuthProvider {
  name: string;
  description: string;
  connected: boolean;
  busy: boolean;
  disabledReason?: string;
  token?: { expiresAt: number; scopes: string[] } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onReauth?: () => void;
}

export interface AuthProvidersStepProps {
  providers: AuthProvider[];
}

export function AuthProvidersStep({ providers }: AuthProvidersStepProps) {
  return (
    <section className="surface p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">
          Подключения
        </h2>
        <p className="text-sm text-slate-400">
          Войдите в Spotify и YouTube — это займёт минуту.
        </p>
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.name} {...provider} />
        ))}
      </div>
    </section>
  );
}
