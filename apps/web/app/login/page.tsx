import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

/** Only exists while COCKPIT_ACCESS_TOKEN is set. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!process.env.COCKPIT_ACCESS_TOKEN?.trim()) redirect("/");
  const { next } = await searchParams;
  // Only same-site paths, so ?next= can't be turned into an open redirect.
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <LoginForm next={target} />;
}
