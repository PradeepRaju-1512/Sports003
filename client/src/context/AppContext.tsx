import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api.ts";

export interface ScopedRole {
  id: number;
  roleCode: string;
  clubId: number | null;
  batchScope: string | null;
  tournamentId: number | null;
  auctionId: number | null;
  matchId: number | null;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  college?: string;
  rollNumber: string | null;
  batch: string;
  programType?: string;
  currentSemester?: number;
  isGraduated?: boolean;
  gender?: string;
  hostel: string | null;
  avatarUrl: string | null;
  qrCodeToken: string;
  accountType: string;
  onboardingComplete: boolean;
  playerProfileId: number | null;
  roles: ScopedRole[];
}

export interface DemoPersona {
  id: number;
  name: string;
  email: string;
  batch: string;
  roles: string[];
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  isUrgentBanner: boolean;
  active: boolean;
  clubId: number | null;
  createdAt: string;
}

export interface BootstrapData {
  settings: {
    showAuctionInNav: boolean;
    showLiveAuctionInNav: boolean;
    currentTournamentId: number | null;
    overviewConfig: {
      headline: string;
      summary: string;
      upcomingTournaments: Array<{ name: string; window: string; mode: string }>;
    };
  };
  urgentBanner: Announcement | null;
  briefNotices: Announcement[];
  liveMatchCount: number;
  hasLiveMatches: boolean;
  onThisDay: {
    id: number;
    roundLabel: string;
    scoreSummary: string | null;
    resultNote: string | null;
    scheduledAt: string;
    tournamentName: string;
    academicYear: number;
    sportName: string;
  } | null;
  unreadNotificationsCount: number;
}

interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface AppContextValue {
  user: SessionUser | null;
  demoSwitcherEnabled: boolean;
  testLoginEnabled: boolean;
  googleOAuthEnabled: boolean;
  demoPersonas: DemoPersona[];
  bootstrap: BootstrapData | null;
  archiveYears: number[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  switchDemoPersona: (userId: number | null) => Promise<void>;
  logout: () => Promise<void>;
  notifyToast: (type: "success" | "error" | "info", message: string) => void;
  hasRole: (roleCode: string) => boolean;
  hasGlobalSportsAuthority: boolean;
  sseVersion: number;
  sseConnected: boolean;
  lastSseEvent: { type: string; data: Record<string, unknown> } | null;
  subscribeSse: (listener: (type: string, data: Record<string, unknown>) => void) => () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [demoSwitcherEnabled, setDemoSwitcherEnabled] = useState(false);
  const [testLoginEnabled, setTestLoginEnabled] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [demoPersonas, setDemoPersonas] = useState<DemoPersona[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [archiveYears, setArchiveYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sseVersion, setSseVersion] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);
  const [lastSseEvent, setLastSseEvent] = useState<{
    type: string;
    data: Record<string, unknown>;
  } | null>(null);
  const sseListenersRef = useRef<Set<(type: string, data: Record<string, unknown>) => void>>(new Set());

  const subscribeSse = useCallback(
    (listener: (type: string, data: Record<string, unknown>) => void) => {
      sseListenersRef.current.add(listener);
      return () => {
        sseListenersRef.current.delete(listener);
      };
    },
    []
  );

  const notifyToast = useCallback((type: "success" | "error" | "info", message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      if (prev.some((t) => t.type === type && t.message === message)) {
        return prev;
      }
      return [...prev, { id, type, message }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [meRes, bootRes, yearsRes] = await Promise.all([
        apiFetch<{
          user: SessionUser | null;
          demoSwitcherEnabled: boolean;
          testLoginEnabled?: boolean;
          googleOAuthEnabled?: boolean;
          demoPersonas: DemoPersona[];
        }>("/api/auth/me"),
        apiFetch<BootstrapData>("/api/bootstrap"),
        apiFetch<{ years: number[] }>("/api/archive/years"),
      ]);
      setUser(meRes.user);
      setDemoSwitcherEnabled(meRes.demoSwitcherEnabled);
      setTestLoginEnabled(Boolean(meRes.testLoginEnabled));
      setGoogleOAuthEnabled(Boolean(meRes.googleOAuthEnabled));
      setDemoPersonas(meRes.demoPersonas);
      setBootstrap(bootRes);
      setArchiveYears(yearsRes.years);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [notifyToast]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Persistent single shared SSE connection for live match, nav, notice, and auction updates
  useEffect(() => {
    const es = new EventSource("/api/stream");
    let bootTimer: ReturnType<typeof setTimeout> | null = null;
    let meTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleBootstrapRefresh = () => {
      if (bootTimer) clearTimeout(bootTimer);
      bootTimer = setTimeout(() => {
        apiFetch<BootstrapData>("/api/bootstrap")
          .then(setBootstrap)
          .catch(() => {});
      }, 150 + Math.floor(Math.random() * 120));
    };

    const scheduleMeRefresh = () => {
      if (meTimer) clearTimeout(meTimer);
      meTimer = setTimeout(() => {
        apiFetch<{
          user: SessionUser | null;
          demoSwitcherEnabled: boolean;
          testLoginEnabled?: boolean;
          googleOAuthEnabled?: boolean;
          demoPersonas: DemoPersona[];
        }>("/api/auth/me")
          .then((meRes) => {
            setUser(meRes.user);
            setDemoSwitcherEnabled(meRes.demoSwitcherEnabled);
            setTestLoginEnabled(Boolean(meRes.testLoginEnabled));
            setGoogleOAuthEnabled(Boolean(meRes.googleOAuthEnabled));
            setDemoPersonas(meRes.demoPersonas);
          })
          .catch(() => {});
      }, 150 + Math.floor(Math.random() * 120));
    };

    const onConnected = () => {
      setSseConnected(true);
      for (const listener of sseListenersRef.current) {
        listener("CONNECTED", { ok: true });
      }
    };
    const onError = () => {
      setSseConnected(false);
    };

    const handleEvent = (type: string) => (ev: MessageEvent) => {
      try {
        const data = ev?.data ? (JSON.parse(ev.data) as Record<string, unknown>) : {};
        setLastSseEvent({ type, data });
        setSseVersion((v) => v + 1);
        for (const listener of sseListenersRef.current) {
          listener(type, data);
        }
        if (type === "NAV_UPDATED" || type === "NOTICE_UPDATED" || type === "NOTIFICATION") {
          scheduleBootstrapRefresh();
        }
        if (type === "NAV_UPDATED" || type === "NOTIFICATION") {
          scheduleMeRefresh();
        }
      } catch {
        // ignore parse issues on heartbeat
      }
    };

    es.addEventListener("CONNECTED", onConnected);
    es.onerror = onError;

    const events = [
      "MATCH_EVENT",
      "MATCH_STATUS",
      "MATCH_CLOCK",
      "MATCH_LINEUP",
      "NAV_UPDATED",
      "NOTICE_UPDATED",
      "CLUB_ACTIVITY",
      "NOTIFICATION",
      "AUCTION_STAGE",
      "AUCTION_BID",
      "AUCTION_OUTCOME",
      "AUCTION_UPDATED",
      "AUCTION_PROJECTOR",
    ];
    events.forEach((evt) => es.addEventListener(evt, handleEvent(evt)));
    return () => {
      if (bootTimer) clearTimeout(bootTimer);
      if (meTimer) clearTimeout(meTimer);
      es.close();
    };
  }, []);

  const switchDemoPersona = async (userId: number | null) => {
    try {
      const res = await apiFetch<{ user: SessionUser | null }>("/api/auth/demo-switch", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setUser(res.user);
      await refreshAll();
      notifyToast("success", userId ? "Switched active persona." : "Switched to Public Guest.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      await refreshAll();
      notifyToast("info", "Signed out.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const hasRole = useCallback(
    (code: string) => Boolean(user?.roles.some((r) => r.roleCode === code)),
    [user]
  );

  const hasGlobalSportsAuthority =
    hasRole("FACULTY_ADVISOR") || hasRole("SPORTS_SECRETARY");

  return (
    <AppContext.Provider
      value={{
        user,
        demoSwitcherEnabled,
        testLoginEnabled,
        googleOAuthEnabled,
        demoPersonas,
        bootstrap,
        archiveYears,
        loading,
        refreshAll,
        switchDemoPersona,
        logout,
        notifyToast,
        hasRole,
        hasGlobalSportsAuthority,
        sseVersion,
        sseConnected,
        lastSseEvent,
        subscribeSse,
      }}
    >
      {children}

      {/* Global Toast Container */}
      <div className="fixed bottom-20 right-4 z-[90] flex flex-col gap-2 max-w-sm md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded border text-sm font-medium shadow-2xl backdrop-blur ${
              t.type === "error"
                ? "bg-[#2A0B0B]/95 border-[#DC2626] text-[#F5F2EB]"
                : t.type === "success"
                ? "bg-[#09221A]/95 border-[#10B981] text-[#F5F2EB]"
                : "bg-[#141418]/95 border-[#D97706] text-[#F5F2EB]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
