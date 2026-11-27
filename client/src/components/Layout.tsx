import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  ChevronDown,
  ClipboardCheck,
  Home,
  LogIn,
  LogOut,
  Menu,
  Radio,
  Shield,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    user,
    demoSwitcherEnabled,
    testLoginEnabled,
    demoPersonas,
    bootstrap,
    archiveYears,
    switchDemoPersona,
    logout,
    refreshAll,
    notifyToast,
    hasRole,
    hasGlobalSportsAuthority,
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const archiveRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (archiveOpen && archiveRef.current && !archiveRef.current.contains(target)) {
        setArchiveOpen(false);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArchiveOpen(false);
        setNotifOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [archiveOpen, notifOpen]);

  // Onboarding state (fixed college = IIITT, collects Year/Batch, Branch, Semester)
  const [onbName, setOnbName] = useState(user?.name ?? "");
  const [onbRoll, setOnbRoll] = useState(user?.rollNumber ?? "");
  const [onbBatch, setOnbBatch] = useState<"1ST" | "2ND" | "3RD" | "4TH" | "MTECH">("1ST");
  const [onbBranch, setOnbBranch] = useState("CSE");
  const [onbSemester, setOnbSemester] = useState(1);
  const [onbGender, setOnbGender] = useState<"BOYS" | "GIRLS">("BOYS");
  const [onbHostel, setOnbHostel] = useState("");

  useEffect(() => {
    if (user) {
      setOnbName(user.name ?? "");
      setOnbRoll(user.rollNumber ?? "");
    }
  }, [user?.id, user?.name, user?.rollNumber]);

  const openNotifications = async () => {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    if (!nextOpen || !user) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const data = await apiFetch<{ notifications: NotificationRow[] }>("/api/notifications");
      setNotifications(data.notifications);
    } catch (err) {
      const msg = (err as Error).message || "Failed to load notifications.";
      setNotifError(msg);
      notifyToast("error", msg);
    } finally {
      setNotifLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshAll();
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({
          name: onbName || user?.name,
          rollNumber: onbRoll || user?.rollNumber,
          batch: onbBatch,
          branch: onbBranch,
          currentSemester: Number(onbSemester) || 1,
          gender: onbGender,
          hostel: onbHostel || null,
        }),
      });
      await refreshAll();
      notifyToast("success", "Onboarding complete! Welcome to IIITT Sports.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const showAuction = Boolean(bootstrap?.settings.showAuctionInNav);
  const showLiveAuction = Boolean(bootstrap?.settings.showLiveAuctionInNav);
  const hasLiveMatches = Boolean(bootstrap?.hasLiveMatches);
  const canAccessScorerNav = Boolean(
    user && (hasGlobalSportsAuthority || hasRole("MATCH_SCORER"))
  );

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap px-2 xl:px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] xl:tracking-[0.12em] transition ${
      isActive ? "text-[#F5F2EB]" : "text-[#A39E96] hover:text-[#F5F2EB]"
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#111113] text-[#F5F2EB] pb-16 lg:pb-0">
      {/* 1. Conditional Ultra-Short Top Alert Banner (<= 5 words) */}
      {bootstrap?.urgentBanner &&
        bootstrap.urgentBanner.title.trim().split(/\s+/).filter(Boolean).length <= 5 && (
          <div className="bg-[#C41E22] text-[#F5F2EB] px-4 py-1 text-center">
            <span className="banner-title text-xs font-semibold">
              {bootstrap.urgentBanner.title}
            </span>
          </div>
        )}

      {/* 2. Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#0D0D0F]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 h-12 flex items-center justify-between gap-3">
          {/* Desktop Single-Row Left Nav (>= 1024px) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 min-w-0 flex-1">
            <NavLink to="/" end className={navLinkCls}>
              Home
            </NavLink>
            <NavLink to="/overview" className={navLinkCls}>
              Overview
            </NavLink>

            {/* Archive Year Dropdown */}
            <div
              ref={archiveRef}
              className="relative"
              onMouseEnter={() => setArchiveOpen(true)}
              onMouseLeave={() => setArchiveOpen(false)}
            >
              <button
                type="button"
                onClick={() => setArchiveOpen((v) => !v)}
                className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition flex items-center gap-1 ${
                  location.pathname.startsWith("/archive")
                    ? "text-[#F5F2EB]"
                    : "text-[#A39E96] hover:text-[#F5F2EB]"
                }`}
              >
                Archive <ChevronDown className="w-3 h-3" />
              </button>
              {archiveOpen && (
                <div className="absolute left-0 top-full pt-1 w-44 z-50">
                  <div className="bg-[#161618] border border-white/15 py-1 shadow-2xl">
                    {archiveYears.map((yr) => (
                      <Link
                        key={yr}
                        to={`/archive/${yr}`}
                        onClick={() => setArchiveOpen(false)}
                        className="block px-3.5 py-2 text-[11px] font-medium text-[#D6CFC2] hover:bg-[#B91C1C]/30 hover:text-[#F5F2EB]"
                      >
                        {yr} Season Archive
                      </Link>
                    ))}
                    <Link
                      to="/archive"
                      onClick={() => setArchiveOpen(false)}
                      className="block px-3.5 py-2 text-[11px] font-medium text-[#D97706] border-t border-white/10 hover:bg-white/5"
                    >
                      All Years &amp; Legacy
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <NavLink to="/tournaments/current" className={navLinkCls}>
              Current Tournament
            </NavLink>

            {showAuction && (
              <NavLink to="/auction" className={navLinkCls}>
                Auction
              </NavLink>
            )}
            {showLiveAuction && (
              <NavLink to="/live-auction" className={navLinkCls}>
                Live Auction
              </NavLink>
            )}

            {/* Dynamic Live OR Upcoming */}
            {hasLiveMatches ? (
              <NavLink
                to="/matches?tab=live"
                className="whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F5F2EB] flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                Live
              </NavLink>
            ) : (
              <NavLink to="/matches?tab=upcoming" className={navLinkCls}>
                Upcoming
              </NavLink>
            )}

            {canAccessScorerNav && (
              <NavLink to="/scorer" className={navLinkCls}>
                Match Scorer
              </NavLink>
            )}

            <NavLink to="/clubs" className={navLinkCls}>
              Clubs
            </NavLink>

            <NavLink to="/roles" className={navLinkCls}>
              Governance
            </NavLink>
          </nav>

          {/* Mobile Brand Title */}
          <Link to="/" className="lg:hidden text-xs font-bold uppercase tracking-[0.18em] text-[#F5F2EB]">
            IIIT Trichy Sports
          </Link>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Demo Persona Switcher (compact responsive width + full tooltip) */}
            {demoSwitcherEnabled && (
              <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-[#8B8680] hidden xl:inline">Role:</span>
                <select
                  aria-label="Demo Persona Switcher"
                  title={
                    user
                      ? `${user.name} (${user.roles.map((r) => r.roleCode).join(", ") || "STUDENT"})`
                      : "Public Guest (Logged Out)"
                  }
                  value={user?.id ?? ""}
                  onChange={(e) =>
                    switchDemoPersona(e.target.value ? Number(e.target.value) : null)
                  }
                  className="max-w-[165px] xl:max-w-[220px] truncate bg-[#161618] border border-white/15 text-[#F5F2EB] text-[11px] rounded px-2 py-1 focus:outline-none focus:border-white/30"
                >
                  <option value="">Public Guest (Logged Out)</option>
                  {demoPersonas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.roles[0] ?? "STUDENT"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={openNotifications}
                aria-label="Notifications"
                className="relative p-1.5 rounded border border-white/10 bg-[#161618] hover:border-white/25 text-[#D6CFC2]"
              >
                <Bell className="w-3.5 h-3.5" />
                {(bootstrap?.unreadNotificationsCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-[#DC2626] text-[9px] font-bold tabular-nums flex items-center justify-center text-[#F5F2EB]">
                    {bootstrap?.unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#161618] border border-white/15 p-3 z-50 shadow-2xl">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#F5F2EB]">Notifications</span>
                    {user && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[11px] text-[#D97706] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {!user ? (
                    <p className="text-xs text-[#8B8680] py-4 text-center">
                      Sign in with your @iiitt.ac.in account to receive personal notifications.
                    </p>
                  ) : notifLoading ? (
                    <p className="text-xs text-[#8B8680] py-4 text-center">
                      Loading notifications...
                    </p>
                  ) : notifError ? (
                    <p className="text-xs text-[#FCA5A5] py-4 text-center">
                      {notifError}
                    </p>
                  ) : notifications.length === 0 ? (
                    <p className="text-xs text-[#8B8680] py-4 text-center">No notifications yet.</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
                              setNotifOpen(false);
                              if (n.linkUrl) navigate(n.linkUrl);
                              refreshAll();
                            } catch (err) {
                              notifyToast("error", (err as Error).message);
                            }
                          }}
                          className={`w-full text-left p-2.5 border transition ${
                            n.isRead
                              ? "bg-[#111113] border-white/5 opacity-75"
                              : "bg-[#1B1314] border-[#B91C1C]/40"
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#F5F2EB]">{n.title}</div>
                          <div className="text-[11px] text-[#D6CFC2] mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-[#8B8680] mt-1 tabular-nums">
                            {formatIST(n.createdAt)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Account Shortcut / Sign In / Switch Account */}
            {user ? (
              <div className="flex items-center gap-1.5">
                {user.playerProfileId && (
                  <Link
                    to={`/players/${user.playerProfileId}`}
                    title={user.name}
                    className="p-1.5 rounded bg-[#161618] border border-white/10 hover:border-white/30 text-[#D6CFC2]"
                  >
                    <User className="w-3.5 h-3.5" />
                  </Link>
                )}
                {(testLoginEnabled || demoSwitcherEnabled) && (
                  <Link
                    to="/login"
                    title="Switch Account"
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-[#161618] border border-white/10 hover:border-[#D97706] text-[10px] font-semibold uppercase tracking-wider text-[#D6CFC2]"
                  >
                    <LogIn className="w-3 h-3 text-[#D97706]" /> Switch
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 rounded bg-[#161618] border border-white/10 hover:border-[#DC2626] text-[#D6CFC2]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] text-[11px] font-semibold uppercase tracking-wider"
              >
                <LogIn className="w-3 h-3" /> Sign In
              </Link>
            )}

            {/* Mobile Hamburger (< 900px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="lg:hidden p-1.5 rounded border border-white/15 bg-[#161618]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-[#0D0D0F] px-4 py-3 space-y-2">
            {demoSwitcherEnabled && (
              <div className="pb-2 border-b border-white/10">
                <label className="text-[10px] uppercase tracking-wider text-[#D97706] block mb-1">
                  Role Switcher
                </label>
                <select
                  value={user?.id ?? ""}
                  onChange={(e) => {
                    switchDemoPersona(e.target.value ? Number(e.target.value) : null);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#161618] border border-white/15 text-[#F5F2EB] text-xs rounded px-2.5 py-2"
                >
                  <option value="">Public Guest (Logged Out)</option>
                  {demoPersonas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.roles.join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold uppercase">
              <Link to="/overview" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Overview</Link>
              <Link to="/tournaments/current" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Tournament</Link>
              <Link
                to={hasLiveMatches ? "/matches?tab=live" : "/matches?tab=upcoming"}
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 bg-[#161618] border border-white/10"
              >
                {hasLiveMatches ? "Live Matches" : "Upcoming"}
              </Link>
              <Link to="/clubs" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Clubs</Link>
              {showAuction && (
                <Link to="/auction" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Auction</Link>
              )}
              {showLiveAuction && (
                <Link to="/live-auction" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Live Auction</Link>
              )}
              {canAccessScorerNav && (
                <Link to="/scorer" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Match Scorer</Link>
              )}
              <Link to="/roles" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">Governance</Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-[#B91C1C]/50 text-[#F59E0B]">
                {user ? "Switch Account" : "Sign In"}
              </Link>
              {archiveYears.map((yr) => (
                <Link key={yr} to={`/archive/${yr}`} onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#161618] border border-white/10">
                  Archive {yr}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Editorial Footer */}
      <footer className="border-t border-white/10 bg-[#0D0D0F] py-6 px-4 text-xs text-[#8B8680]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#B91C1C]" />
            <span>
              IIIT Tiruchirappalli • Official Sports Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            {hasGlobalSportsAuthority && (
              <Link to="/roles" className="text-[#D97706] hover:underline">
                Sports Admin &amp; Audit Console
              </Link>
            )}
            <Link to="/archive" className="hover:text-[#F5F2EB]">
              Permanent Archive
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile PWA Bottom Navigation Bar (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0D0D0F]/95 backdrop-blur border-t border-white/10 grid grid-cols-5 h-16">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] gap-1 transition ${
              isActive ? "text-[#D97706] font-bold" : "text-[#D6CFC2]"
            }`
          }
        >
          <Home className="w-4 h-4" /> Home
        </NavLink>
        <NavLink
          to="/clubs"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] gap-1 transition ${
              isActive ? "text-[#D97706] font-bold" : "text-[#D6CFC2]"
            }`
          }
        >
          <Users className="w-4 h-4" /> Clubs
        </NavLink>
        <NavLink
          to="/matches"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] gap-1 transition ${
              isActive ? "text-[#D97706] font-bold" : "text-[#D6CFC2]"
            }`
          }
        >
          {hasLiveMatches ? (
            <Radio className="w-4 h-4 text-[#DC2626] animate-pulse" />
          ) : (
            <Trophy className="w-4 h-4" />
          )}
          {hasLiveMatches ? "Live" : "Matches"}
        </NavLink>
        <NavLink
          to="/archive"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] gap-1 transition ${
              isActive ? "text-[#D97706] font-bold" : "text-[#D6CFC2]"
            }`
          }
        >
          <Archive className="w-4 h-4" /> Archive
        </NavLink>
        <NavLink
          to={user ? (user.playerProfileId ? `/players/${user.playerProfileId}` : "/roles") : "/login"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] gap-1 transition ${
              isActive ? "text-[#D97706] font-bold" : "text-[#D6CFC2]"
            }`
          }
        >
          <ClipboardCheck className="w-4 h-4" /> {user ? "Profile" : "Sign In"}
        </NavLink>
      </nav>

      {/* Frictionless Student Onboarding Modal (Zero Sports Questions!) */}
      {user && !user.onboardingComplete && (
        <div className="fixed inset-0 z-[85] bg-black/85 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wider text-[#D97706]">
              Complete Student Profile
            </h2>
            <p className="text-xs text-[#D6CFC2]">
              Quick institute verification—just your academic details to unlock your Student QR ID and club portals.
            </p>
            <div className="px-3 py-1.5 rounded bg-[#08080A] border border-white/10 text-[11px] flex items-center justify-between">
              <span className="text-[#8B8680] uppercase tracking-wider">Institute</span>
              <span className="font-bold text-[#F5F2EB]">IIITT (Tiruchirappalli)</span>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-[#D6CFC2] block mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={onbName}
                  onChange={(e) => setOnbName(e.target.value)}
                  className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={onbRoll}
                    onChange={(e) => setOnbRoll(e.target.value)}
                    placeholder="251119"
                    className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Batch / Year</label>
                  <select
                    value={onbBatch}
                    onChange={(e) => {
                      const nextB = e.target.value as typeof onbBatch;
                      setOnbBatch(nextB);
                      const defaultSem =
                        nextB === "1ST" ? 1 : nextB === "2ND" ? 3 : nextB === "3RD" ? 5 : nextB === "4TH" ? 7 : 1;
                      setOnbSemester(defaultSem);
                    }}
                    className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                  >
                    <option value="1ST">1st Year (B.Tech)</option>
                    <option value="2ND">2nd Year (B.Tech)</option>
                    <option value="3RD">3rd Year (B.Tech)</option>
                    <option value="4TH">4th Year (B.Tech)</option>
                    <option value="MTECH">M.Tech</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Branch</label>
                  <select
                    value={onbBranch}
                    onChange={(e) => setOnbBranch(e.target.value)}
                    className="w-full bg-[#0D0D0F] border border-white/15 px-2 py-2 text-xs"
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="ME">ME</option>
                    <option value="CE">CE</option>
                    <option value="AIDS">AI&amp;DS</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Semester</label>
                  <select
                    value={onbSemester}
                    onChange={(e) => setOnbSemester(Number(e.target.value))}
                    className="w-full bg-[#0D0D0F] border border-white/15 px-2 py-2 text-xs font-mono"
                  >
                    {(onbBatch === "MTECH" ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7, 8]).map((sem) => (
                      <option key={sem} value={sem}>
                        Sem {sem}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Track</label>
                  <select
                    value={onbGender}
                    onChange={(e) => setOnbGender(e.target.value as typeof onbGender)}
                    className="w-full bg-[#0D0D0F] border border-white/15 px-2 py-2 text-xs"
                  >
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#D6CFC2] block mb-1">Hostel (Optional)</label>
                <input
                  type="text"
                  value={onbHostel}
                  onChange={(e) => setOnbHostel(e.target.value)}
                  placeholder="e.g., Cauvery / Vaigai"
                  className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-semibold uppercase tracking-wider"
              >
                Save &amp; Enter IIITT Sports
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
