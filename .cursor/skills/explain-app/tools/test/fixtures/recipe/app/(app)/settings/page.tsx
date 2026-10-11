import { getSession } from "@/lib/auth";
import { planFor } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default async function SettingsPage() {
  const session = await getSession();
  const plan = await planFor(session?.user?.email);
  return (
    <section>
      <h1>Settings</h1>
      <Input defaultValue={session?.user?.name ?? ""} aria-label="Your name" />
      <Badge>{plan}</Badge>
    </section>
  );
}
