import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, CheckCircle2, Edit3, Plus, Trash2, Trophy } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";

interface TournamentOverviewRow {
  id: number;
  name: string;
  academicYear: number;
  semester: string;
  tournamentType: string;
  rosterMode: string;
  status: string;
  isCurrent: boolean;
  startsAt: string;
}

export function OverviewPage() {
  const { bootstrap, hasGlobalSportsAuthority, refreshAll, notifyToast } = useApp();
  const cfg = bootstrap?.settings.overviewConfig;

  const [tournamentsList, setTournamentsList] = useState<TournamentOverviewRow[]>([]);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<TournamentOverviewRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [events, setEvents] = useState<Array<{ name: string; window: string; mode: string }>>([]);
  const [notifyEveryone, setNotifyEveryone] = useState(false);

  const loadTournaments = useCallback(async () => {
    try {
      const res = await apiFetch<{ tournaments: TournamentOverviewRow[] }>("/api/tournaments");
      setTournamentsList(res.tournaments ?? []);
    } catch (err) {
      notifyToast("error", (err as Error).message || "Failed to load tournaments list.");
    }
  }, [notifyToast]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    if (!confirmActivate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activatingId === null) {
        setConfirmActivate(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmActivate, activatingId]);

  useEffect(() => {
    if (cfg) {
      setHeadline(cfg.headline);
      setSummary(cfg.summary);
      setEvents(cfg.upcomingTournaments);
    }
  }, [cfg]);

  const handleActivateTournament = async (id: number, name: string) => {
    setActivatingId(id);
    try {
      await apiFetch(`/api/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CURRENT" }),
      });
      await Promise.all([loadTournaments(), refreshAll()]);
      notifyToast("success", `${name} is now the active Current Tournament!`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setActivatingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/settings/overview", {
        method: "PATCH",
        body: JSON.stringify({
          headline,
          summary,
          upcomingTournaments: events,
          notifyEveryone,
        }),
      });
      setEditing(false);
      await refreshAll();
      notifyToast("success", notifyEveryone ? "Overview saved and everyone notified." : "Overview updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D6CFC2]/15 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            Institute Sports Calendar
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB] mt-1">
            {cfg?.headline ?? "Upcoming Tournaments & Dates"}
          </h1>
        </div>
        {hasGlobalSportsAuthority && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#D97706]/15"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#D97706]" />
            {editing ? "Close Editor" : "Edit Overview"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-6">
          <p className="text-sm text-[#D6CFC2] leading-relaxed">{cfg?.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(cfg?.upcomingTournaments ?? []).map((ev, i) => (
              <div key={i} className="rdr-panel rounded-lg p-5 space-y-2 border-l-4 border-l-[#B91C1C]">
                <div className="flex items-center gap-2 text-xs text-[#D97706] font-mono">
                  <Calendar className="w-3.5 h-3.5" /> {ev.window}
                </div>
                <div className="font-editorial text-2xl text-[#F5F2EB]">{ev.name}</div>
                <div className="text-xs text-[#8B8680] uppercase tracking-wider">
                  Roster Mode: <span className="text-[#D6CFC2]">{ev.mode}</span>
                </div>
              </div>
            ))}
          </div>

          {tournamentsList.length > 0 && (
            <section className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#D97706]" /> Institute Tournaments
                </h2>
                <Link
                  to="/tournaments/current"
                  className="text-xs font-semibold text-[#D97706] hover:underline flex items-center gap-1"
                >
                  Open Current Tournament <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tournamentsList.map((t) => (
                  <div
                    key={t.id}
                    className={`rdr-panel rounded-lg p-5 space-y-3 border ${
                      t.isCurrent ? "border-[#10B981]/60" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-[#D97706]">
                        {t.academicYear} • {t.semester} • {t.rosterMode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase ${
                          t.isCurrent
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : "bg-white/10 text-[#D6CFC2]"
                        }`}
                      >
                        {t.isCurrent ? "CURRENT" : t.status}
                      </span>
                    </div>
                    <div className="font-editorial text-2xl text-[#F5F2EB]">{t.name}</div>
                    <div className="text-xs text-[#8B8680]">
                      Starts: {formatIST(t.startsAt)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {t.isCurrent ? (
                        <Link
                          to="/tournaments/current"
                          className="px-3.5 py-1.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-xs font-bold uppercase flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Manage Current Tournament
                        </Link>
                      ) : (
                        hasGlobalSportsAuthority &&
                        t.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            disabled={activatingId === t.id}
                            onClick={() => setConfirmActivate(t)}
                            className="px-3.5 py-1.5 rounded bg-[#B91C1C] hover:bg-[#DC2626] disabled:opacity-50 text-[#F5F2EB] text-xs font-bold uppercase"
                          >
                            {activatingId === t.id
                              ? "Activating..."
                              : "Activate / Set as Current Tournament"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="rdr-panel rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs text-[#D6CFC2] block mb-1">Calendar Headline</label>
            <input
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#D6CFC2] block mb-1">Overview Summary</label>
            <textarea
              rows={3}
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#D97706]">
                Scheduled Tournaments
              </span>
              <button
                type="button"
                onClick={() =>
                  setEvents((prev) => [
                    ...prev,
                    { name: "New Tournament", window: "TBD", mode: "Captain Submission" },
                  ])
                }
                className="text-xs flex items-center gap-1 text-[#10B981] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Event
              </button>
            </div>
            {events.map((ev, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#08080A] p-3 rounded border border-white/10">
                <input
                  value={ev.name}
                  onChange={(e) =>
                    setEvents((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                    )
                  }
                  placeholder="Tournament Name"
                  className="sm:col-span-2 bg-[#141418] border border-white/10 rounded px-2.5 py-1.5 text-xs"
                />
                <input
                  value={ev.window}
                  onChange={(e) =>
                    setEvents((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, window: e.target.value } : x))
                    )
                  }
                  placeholder="Dates"
                  className="bg-[#141418] border border-white/10 rounded px-2.5 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    value={ev.mode}
                    onChange={(e) =>
                      setEvents((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, mode: e.target.value } : x))
                      )
                    }
                    placeholder="Mode"
                    className="flex-1 bg-[#141418] border border-white/10 rounded px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setEvents((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-[#DC2626] hover:bg-white/5 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs text-[#D97706] font-semibold">
              <input
                type="checkbox"
                checked={notifyEveryone}
                onChange={(e) => setNotifyEveryone(e.target.checked)}
              />
              Notify everyone (Yes / No) when saving Overview
            </label>
            <button
              type="submit"
              className="px-5 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider"
            >
              Save Overview
            </button>
          </div>
        </form>
      )}

      {/* Confirm Activate Tournament Modal */}
      {confirmActivate && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#F5F2EB]">
              Switch Current Tournament?
            </h3>
            <p className="text-xs text-[#D6CFC2] leading-relaxed">
              Set{" "}
              <span className="font-bold text-[#F5F2EB]">{confirmActivate.name}</span> (
              {confirmActivate.academicYear} • {confirmActivate.semester}) as the active{" "}
              <span className="text-[#10B981] font-semibold">Current Tournament</span>? Any
              currently active flagship tournament will be moved back to Upcoming.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmActivate(null)}
                className="px-3.5 py-2 rounded bg-white/10 hover:bg-white/15 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={activatingId === confirmActivate.id}
                onClick={async () => {
                  const target = confirmActivate;
                  setConfirmActivate(null);
                  await handleActivateTournament(target.id, target.name);
                }}
                className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase text-[#F5F2EB]"
              >
                Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
