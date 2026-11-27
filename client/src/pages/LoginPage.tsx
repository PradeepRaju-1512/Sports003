import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";

const TEST_ROLE_OPTIONS = [
  { code: "STUDENT", label: "Student (Default)", note: "Standard student profile & club applicant" },
  { code: "SPORTS_SECRETARY", label: "Sports Secretary", note: "Global sports admin & auction controller" },
  { code: "FACULTY_ADVISOR", label: "Faculty Advisor / PED", note: "Full institute oversight & verification" },
  { code: "CLUB_SECRETARY", label: "Club Secretary (Cricket)", note: "Manages IIITT Cricket Club & inductions" },
  { code: "CLUB_COORDINATOR", label: "Club Coordinator (Cricket 2nd Yr)", note: "Batch coordinator & trial evaluator" },
  { code: "MATCH_SCORER", label: "Match Scorer", note: "Access to /scorer live match console" },
  { code: "AUCTION_OPERATOR", label: "Auction Operator", note: "Operates Prothymos live bidding stage" },
  { code: "CAPTAIN", label: "Team Captain", note: "Submit tournament rosters & watchlist" },
] as const;

export function LoginPage() {
  const {
    user,
    demoSwitcherEnabled,
    testLoginEnabled,
    googleOAuthEnabled,
    demoPersonas,
    switchDemoPersona,
    logout,
    refreshAll,
    notifyToast,
  } = useApp();

  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState<(typeof TEST_ROLE_OPTIONS)[number]["code"]>("STUDENT");
  const [submitting, setSubmitting] = useState(false);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      notifyToast("error", "Enter any username/email and a non-empty password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: { name: string }; created: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          roleCode,
        }),
      });
      await refreshAll();
      setUsername("");
      setPassword("");
      notifyToast(
        "success",
        res.created
          ? `Created test account and signed in as ${res.user.name}.`
          : `Signed in as ${res.user.name}.`
      );
      navigate("/", { replace: true });
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const isProdCleanAuth = !testLoginEnabled && !demoSwitcherEnabled;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            {isProdCleanAuth
              ? "IIIT Tiruchirappalli • Official Sports Portal"
              : "IIIT Tiruchirappalli • Identity & Role Testing"}
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">
            {isProdCleanAuth ? "Sign In" : "Sign In / Switch Account"}
          </h1>
          <p className="text-xs text-[#8B8680] mt-1">
            {isProdCleanAuth
              ? "Sign in with your official @iiitt.ac.in Google account to access student, captain, scorer, and governance portals."
              : "Sign in with any seeded username, roll number, or email — or enter any new username and non-empty password to create a test session instantly."}
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        )}
      </div>

      {/* Active Session Banner */}
      {user ? (
        <section className="rdr-panel rdr-border-crimson rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-[#10B981] font-bold flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" /> Active Signed-In Session
            </div>
            <div className="font-editorial text-2xl text-[#F5F2EB]">{user.name}</div>
            <div className="text-xs text-[#D6CFC2]">
              {user.email} • Roll: {user.rollNumber ?? "N/A"} • Batch: {user.batch}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {user.roles.map((r) => (
                <span
                  key={r.id}
                  className="px-2 py-0.5 rounded bg-[#D97706]/20 border border-[#D97706]/40 text-[#F59E0B] font-mono text-[10px] font-bold"
                >
                  {r.roleCode}
                  {r.clubId ? ` (Club #${r.clubId})` : ""}
                  {r.batchScope ? ` • ${r.batchScope}` : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {user.playerProfileId && (
              <Link
                to={`/players/${user.playerProfileId}`}
                className="px-3.5 py-2 rounded bg-[#141418] border border-white/15 hover:border-[#D97706] text-[#F5F2EB] font-semibold"
              >
                View My Profile
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-2 rounded bg-[#B91C1C]/30 hover:bg-[#B91C1C] border border-[#DC2626]/50 text-[#F5F2EB] font-bold uppercase flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </section>
      ) : (
        <section className="rdr-panel rounded-lg p-4 border border-white/10 text-xs text-[#D6CFC2]">
          Currently browsing as <span className="text-[#D97706] font-bold">Public Guest (Logged Out)</span>.
          {isProdCleanAuth
            ? " Sign in with your @iiitt.ac.in account below."
            : " Sign in below or pick any demo persona on the right."}
        </section>
      )}

      <div className={`grid grid-cols-1 ${isProdCleanAuth ? "max-w-md mx-auto" : "lg:grid-cols-2"} gap-6`}>
        {/* Sign In Card */}
        <section className="rdr-panel rdr-border-crimson rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <KeyRound className="w-5 h-5 text-[#D97706]" />
            <h2 className="font-editorial text-2xl text-[#F5F2EB]">
              {isProdCleanAuth ? "IIITT Google Sign In" : "Username / Password Sign In"}
            </h2>
          </div>

          {!testLoginEnabled ? (
            <div className="p-4 rounded bg-[#08080A] border border-white/15 text-xs text-[#D6CFC2] space-y-3">
              <p>Sign in with your verified @iiitt.ac.in Google account.</p>
              {googleOAuthEnabled ? (
                <a
                  href="/api/auth/google"
                  className="block text-center px-4 py-2.5 rounded bg-[#D97706] hover:bg-[#F59E0B] text-[#08080A] font-bold uppercase tracking-wider"
                >
                  Sign In with @iiitt.ac.in Google
                </a>
              ) : (
                <p className="text-[#8B8680]">Google OAuth is not configured on this server.</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleCredentialLogin} className="space-y-4 text-xs">
              <div>
                <label htmlFor="login-username" className="text-[#D6CFC2] block mb-1 font-semibold">
                  Username, Roll Number, or Email
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., 221101, Vikram Nair, or tester1@iiitt.ac.in"
                  className="w-full bg-[#08080A] border border-white/15 focus:border-[#D97706] rounded px-3 py-2.5 text-sm text-[#F5F2EB] outline-none"
                />
                <p className="text-[11px] text-[#8B8680] mt-1">
                  Matches existing accounts by email, roll number, or name; creates a new test account automatically if not found.
                </p>
              </div>

              <div>
                <label htmlFor="login-password" className="text-[#D6CFC2] block mb-1 font-semibold">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any non-empty password"
                  className="w-full bg-[#08080A] border border-white/15 focus:border-[#D97706] rounded px-3 py-2.5 text-sm text-[#F5F2EB] outline-none"
                />
              </div>

              <div>
                <label htmlFor="login-role" className="text-[#D6CFC2] block mb-1 font-semibold flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#D97706]" /> Test Role (Applied if Username is New)
                </label>
                <select
                  id="login-role"
                  value={roleCode}
                  onChange={(e) =>
                    setRoleCode(e.target.value as (typeof TEST_ROLE_OPTIONS)[number]["code"])
                  }
                  className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2.5 text-xs text-[#F5F2EB]"
                >
                  {TEST_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label} — {opt.note}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {submitting ? "Signing In..." : "Sign In"}
              </button>

              {googleOAuthEnabled && (
                <a
                  href="/api/auth/google"
                  className="block w-full py-2 text-center rounded bg-[#141418] border border-[#D97706]/60 text-[#F59E0B] font-bold uppercase tracking-wider"
                >
                  Sign In with @iiitt.ac.in Google
                </a>
              )}
            </form>
          )}
        </section>

        {/* One-Click Demo Personas & Role Switcher */}
        {!isProdCleanAuth && (
        <section className="rdr-panel rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D97706]" />
              <h2 className="font-editorial text-2xl text-[#F5F2EB]">
                Quick Demo Role Switcher
              </h2>
            </div>
            {user && (
              <button
                type="button"
                onClick={async () => {
                  await switchDemoPersona(null);
                }}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px] text-[#D6CFC2] font-semibold"
              >
                Switch to Guest
              </button>
            )}
          </div>

          {!demoSwitcherEnabled || demoPersonas.length === 0 ? (
            <p className="text-xs text-[#8B8680]">
              Demo persona switcher is unavailable in this environment.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {demoPersonas.map((p) => {
                const isActive = user?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      await switchDemoPersona(p.id);
                      navigate("/", { replace: true });
                    }}
                    className={`w-full text-left p-3 rounded border transition flex items-center justify-between gap-3 ${
                      isActive
                        ? "bg-[#B91C1C]/20 border-[#DC2626] text-[#F5F2EB]"
                        : "bg-[#08080A] border-white/10 hover:border-[#D97706]/60 text-[#D6CFC2]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#F5F2EB] flex items-center gap-2">
                        {p.name}
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] text-[10px] uppercase font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8B8680] truncate">
                        {p.email} · {p.batch}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 shrink-0 max-w-[200px]">
                      {(p.roles.length > 0 ? p.roles : ["STUDENT"]).map((role, idx) => (
                        <span
                          key={`${p.id}-${role}-${idx}`}
                          className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-[#F59E0B] flex items-center gap-1"
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {role}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
