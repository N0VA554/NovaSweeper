"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const data = new FormData(event.currentTarget);
    const payload =
      mode === "register"
        ? {
            username: String(data.get("username") ?? ""),
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? ""),
            confirmPassword: String(data.get("confirmPassword") ?? "")
          }
        : {
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? "")
          };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setMessage(body?.message ?? "Request failed.");
      setIsSubmitting(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" ? (
        <label>
          <span>Username</span>
          <input name="username" minLength={3} maxLength={32} required />
        </label>
      ) : null}
      <label>
        <span>Email</span>
        <input name="email" type="email" required />
      </label>
      <label>
        <span>Password</span>
        <div className="password-field">
          <input name="password" type={showPassword ? "text" : "password"} minLength={mode === "register" ? 8 : 1} required />
          <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {mode === "register" ? (
        <label>
          <span>Confirm password</span>
          <div className="password-field">
            <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} minLength={8} required />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
      <button className="play-again-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Working..." : mode === "register" ? "Create account" : "Login"}
      </button>
      <p className="auth-switch">
        {mode === "register" ? "Already have an account?" : "Need an account?"}{" "}
        <Link href={mode === "register" ? "/login" : "/register"}>{mode === "register" ? "Login" : "Register"}</Link>
      </p>
    </form>
  );
}
