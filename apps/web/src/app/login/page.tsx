import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/profile");

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="back-link" href="/">NovaSweeper</Link>
        <p className="eyebrow">Account access</p>
        <h1>Login</h1>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
