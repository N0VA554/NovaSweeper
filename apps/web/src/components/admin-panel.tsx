"use client";

import { useState } from "react";
import type { AppUser } from "@/lib/server/auth";

type AdminConfig = {
  registrationEnabled: boolean;
  usernameUniqueEnabled: boolean;
  emailUniqueEnabled: boolean;
  maintenanceMessage: string;
  defaultGameMode: "solo" | "pve";
};

export function AdminPanel({ initialUsers, initialConfig }: { initialUsers: AppUser[]; initialConfig: AdminConfig }) {
  const [users, setUsers] = useState(initialUsers);
  const [config, setConfig] = useState(initialConfig);
  const [message, setMessage] = useState("");

  async function updateUser(userId: string, patch: Partial<Pick<AppUser, "role" | "status">>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch })
    });

    if (!response.ok) {
      setMessage("Could not update user.");
      return;
    }

    const body = (await response.json()) as { user: AppUser };
    setUsers((current) => current.map((user) => (user.id === body.user.id ? body.user : user)));
    setMessage("User updated.");
  }

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    setMessage(response.ok ? "System config saved." : "Could not save config.");
  }

  return (
    <div className="admin-grid">
      <section className="admin-section">
        <p className="eyebrow">Users</p>
        <div className="admin-table">
          {users.map((user) => (
            <div className="admin-user-row" key={user.id}>
              <div>
                <strong>{user.username}</strong>
                <span>{user.email}</span>
              </div>
              <select value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as AppUser["role"] })}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <select value={user.status} onChange={(event) => updateUser(user.id, { status: event.target.value as AppUser["status"] })}>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <p className="eyebrow">System config</p>
        <form className="auth-form" onSubmit={saveConfig}>
          <label className="checkbox-row">
            <input
              checked={config.registrationEnabled}
              type="checkbox"
              onChange={(event) => setConfig((current) => ({ ...current, registrationEnabled: event.target.checked }))}
            />
            <span>Registration enabled</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={config.usernameUniqueEnabled}
              type="checkbox"
              onChange={(event) => setConfig((current) => ({ ...current, usernameUniqueEnabled: event.target.checked }))}
            />
            <span>Require unique username</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={config.emailUniqueEnabled}
              type="checkbox"
              onChange={(event) => setConfig((current) => ({ ...current, emailUniqueEnabled: event.target.checked }))}
            />
            <span>Require unique email</span>
          </label>
          <label>
            <span>Default game mode</span>
            <select value={config.defaultGameMode} onChange={(event) => setConfig((current) => ({ ...current, defaultGameMode: event.target.value as "solo" | "pve" }))}>
              <option value="solo">solo</option>
              <option value="pve">pve</option>
            </select>
          </label>
          <label>
            <span>Maintenance message</span>
            <textarea value={config.maintenanceMessage} maxLength={240} onChange={(event) => setConfig((current) => ({ ...current, maintenanceMessage: event.target.value }))} />
          </label>
          <button className="play-again-button" type="submit">
            Save config
          </button>
          {message ? <p className="form-message">{message}</p> : null}
        </form>
      </section>
    </div>
  );
}
