import { AppShell } from "@/components/AppShell";
import { IdleLogout } from "@/components/IdleLogout";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <IdleLogout />
      {children}
    </AppShell>
  );
}
