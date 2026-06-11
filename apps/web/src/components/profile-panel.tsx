"use client";

import { useRouter } from "next/navigation";
import type { AppUser } from "@/lib/server/auth";

export function ProfilePanel({ user }: { user: AppUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="profile-grid">
      <div className="profile-card">
        <span>Username</span>
        <strong>{user.username}</strong>
      </div>
      <div className="profile-card">
        <span>Email</span>
        <strong>{user.email}</strong>
      </div>
      <div className="profile-card">
        <span>Role</span>
        <strong>{user.role}</strong>
      </div>
      <div className="profile-card">
        <span>Status</span>
        <strong>{user.status}</strong>
      </div>
      <button className="play-again-button" type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
