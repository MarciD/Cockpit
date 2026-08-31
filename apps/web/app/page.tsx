import { listProfiles } from "@cockpit/db";
import { ProfileLanding } from "@/components/profile-landing";
import { getDb } from "@/lib/db";
import { userName } from "@/lib/user";

export const dynamic = "force-dynamic";

export default function Home() {
  const rows = listProfiles(getDb());
  return (
    <ProfileLanding
      userName={userName()}
      profiles={rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        accent: r.accent,
        monogram: r.monogram,
      }))}
    />
  );
}
