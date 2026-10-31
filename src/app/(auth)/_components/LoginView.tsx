"use client";
// Sign in / Create account tabs (WAI-ARIA tabs pattern: arrow keys move between tabs).
import { useRef, useState, type KeyboardEvent } from "react";
import { AuthCard, AUTH_LINK } from "./AuthCard";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type Tab = "signin" | "signup";
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Create account" },
];

export function LoginView({ next, initialTab }: { next: string | null; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ signin: null, signup: null });

  function onKeyDown(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target: Tab = event.key === "Home" || event.key === "ArrowLeft" ? "signin" : "signup";
    setTab(target);
    refs.current[target]?.focus();
  }

  const tabs = (
    <div role="tablist" aria-label="Account access" onKeyDown={onKeyDown} className="grid grid-cols-2 border-b border-line">
      {TABS.map((t) => {
        const selected = tab === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls="auth-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`min-h-12 border-b-2 text-sm font-medium focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary ${
              selected ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const isSignIn = tab === "signin";
  return (
    <AuthCard
      top={tabs}
      title={isSignIn ? "Welcome back" : "Create your account"}
      subtitle={
        isSignIn
          ? "Sign in to manage your subscriptions and invoices."
          : "Customer accounts can view subscriptions and renew or close them."
      }
      footer={
        isSignIn ? (
          "Staff and customers sign in here."
        ) : (
          <>
            Already registered?{" "}
            <button type="button" onClick={() => setTab("signin")} className={AUTH_LINK}>
              Sign in
            </button>
          </>
        )
      }
    >
      <div id="auth-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {isSignIn ? <SignInForm next={next} /> : <SignUpForm />}
      </div>
    </AuthCard>
  );
}
