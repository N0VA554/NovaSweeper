import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfilePanel } from "@/components/profile-panel";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="auth-page">
      <section className="auth-card wide-card">
        <Link className="back-link" href="/">Back to game</Link>
        <p className="eyebrow">Pilot profile</p>
        <h1>{user.username}</h1>
        <ProfilePanel user={user} />
        {user.role === "admin" ? (
          <Link className="admin-link" href="/admin">
            Open admin
          </Link>
        ) : null}
      </section>
    </main>
  );
}
