import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Award, Edit3, Lock, ShieldCheck, Trophy } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";

interface PlayerProfileData {
  profile: {
    id: number;
    displayName: string;
    college?: string;
    batch: string;
    programType?: string;
    currentSemester?: number;
    isGraduated?: boolean;
    gender?: string;
    branch: string | null;
    rollNumber: string | null;
    visibility: "PUBLIC" | "IIITT_ONLY" | "PRIVATE";
    isClaimed: boolean;
    bio: string | null;
    preferredSports: string[];
    privacyRestricted: boolean;
  };
  clubBadges: Array<{
    clubId: number;
    clubSlug: string;
    clubName: string;
    role: string;
    batchScope: string | null;
    scopeLabel?: string | null;
    status?: string;
    inductedAt?: string | null;
  }>;
  teamAppearances: Array<{
    teamId: number;
    teamName: string;
    shortCode: string;
    playingRole: string | null;
    playerClass: string;
    tournamentId: number;
    tournamentName: string;
    academicYear: number;
    sportName: string;
  }>;
  matchStats: Array<{
    matchId: number;
    roundLabel: string;
    scoreSummary: string | null;
    sportName: string;
    statsJson: Record<string, unknown>;
    isMvp: boolean;
  }>;
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, notifyToast } = useApp();
  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [branch, setBranch] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "IIITT_ONLY" | "PRIVATE">("PUBLIC");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<PlayerProfileData>(`/api/players/${id}`);
      setData(res);
      setBio(res.profile.bio ?? "");
      setBranch(res.profile.branch ?? "");
      setVisibility(res.profile.visibility);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  }, [id, notifyToast]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const isOwner = Boolean(user?.playerProfileId && user.playerProfileId === Number(id));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/players/me", {
        method: "PATCH",
        body: JSON.stringify({ bio, branch, visibility }),
      });
      setEditing(false);
      await load();
      notifyToast("success", "Sports profile updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  if (!data) {
    return <div className="max-w-5xl mx-auto p-8 text-sm text-[#8B8680]">Loading Player Profile...</div>;
  }

  const { profile, clubBadges, teamAppearances, matchStats } = data;

  const formatBatchScopeLabel = (scope: string | null): string => {
    switch (scope) {
      case "1ST":
        return "1st Year";
      case "2ND":
        return "2nd Year";
      case "3RD":
        return "3rd Year";
      case "4TH":
        return "4th Year";
      case "MTECH":
        return "MTech";
      case "ALL":
        return "All Batches";
      default:
        return scope ?? "";
    }
  };

  const formatClubRole = (b: PlayerProfileData["clubBadges"][number]): string => {
    if (b.role === "SECRETARY") return "Club Secretary";
    if (b.role === "COORDINATOR") {
      const batchText = formatBatchScopeLabel(b.batchScope);
      const labelText = b.scopeLabel ? ` (${b.scopeLabel})` : "";
      return `Club Coordinator${batchText ? ` • ${batchText}` : ""}${labelText}`;
    }
    return "Inducted Member";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Card */}
      <div className="rdr-panel rdr-border-crimson rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#141418] border border-white/15 font-mono text-[#D6CFC2]">
              {profile.college ?? "IIITT"}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#B91C1C]/30 border border-[#B91C1C] font-bold">
              {profile.batch} {profile.branch ? `• ${profile.branch}` : ""}
              {profile.currentSemester ? ` • Sem ${profile.currentSemester}` : ""}
            </span>
            {profile.isGraduated && (
              <span className="px-2 py-0.5 rounded bg-[#D97706]/20 border border-[#D97706]/50 text-[#F59E0B] font-bold uppercase text-[10px]">
                Graduated / Alumni
              </span>
            )}
            {profile.rollNumber && (
              <span className="font-mono text-[#D97706]">{profile.rollNumber}</span>
            )}
            {!profile.isClaimed && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-[#D6CFC2]">
                Historical Alumni Record
              </span>
            )}
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">
            {profile.displayName}
          </h1>
          {profile.privacyRestricted ? (
            <p className="text-xs text-[#8B8680] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Personal bio restricted by user privacy settings; official tournament &amp; archive records remain public.
            </p>
          ) : (
            profile.bio && <p className="text-sm text-[#D6CFC2]">{profile.bio}</p>
          )}

          {/* Verified Club Badges */}
          {clubBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {clubBadges.map((b) => (
                <Link
                  key={b.clubId}
                  to={`/clubs/${b.clubSlug}`}
                  className="px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[11px] font-bold flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> {b.clubName} • {formatClubRole(b)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {isOwner && user?.qrCodeToken && (
            <div className="p-2.5 rounded bg-[#F5F2EB] text-[#08080A] text-center space-y-1">
              <QRCodeSVG value={user.qrCodeToken} size={76} />
              <div className="text-[9px] font-mono font-bold">{user.qrCodeToken}</div>
            </div>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="px-3 py-2 rounded bg-[#141418] border border-[#D97706]/50 text-xs font-semibold flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#D97706]" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {editing && isOwner && (
        <form onSubmit={handleSave} className="rdr-panel rounded-lg p-5 space-y-3">
          <h2 className="font-editorial text-2xl text-[#D97706]">Edit Sports Profile &amp; Privacy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#D6CFC2] block mb-1">Branch</label>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="CSE / ECE / ME"
                className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-[#D6CFC2] block mb-1">Profile Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
              >
                <option value="PUBLIC">Public (Anyone)</option>
                <option value="IIITT_ONLY">IIITT Students Only</option>
                <option value="PRIVATE">Private (Official stats stay public)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#D6CFC2] block mb-1">Sports Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-[#B91C1C] text-xs font-bold uppercase"
          >
            Save Profile
          </button>
        </form>
      )}

      {/* Clubs & Leadership Positions */}
      <section className="rdr-panel rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="font-editorial text-2xl flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#10B981]" /> Clubs &amp; Leadership Positions (
            {clubBadges.length})
          </h2>
        </div>
        {clubBadges.length === 0 ? (
          <p className="text-xs text-[#8B8680]">No active club memberships yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clubBadges.map((b) => (
              <Link
                key={b.clubId}
                to={`/clubs/${b.clubSlug}`}
                className="p-3.5 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/60 transition flex items-start justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-bold text-[#F5F2EB] truncate">{b.clubName}</div>
                  <div className="text-xs text-[#D97706] font-semibold">{formatClubRole(b)}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold uppercase shrink-0">
                  {b.status ?? "INDUCTED"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Teams Represented & Career Match Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rdr-panel rounded-lg p-5 space-y-3">
          <h2 className="font-editorial text-2xl flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#D97706]" /> Teams &amp; Tournament History
          </h2>
          {teamAppearances.length === 0 ? (
            <p className="text-xs text-[#8B8680]">No tournament appearances recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {teamAppearances.map((t, idx) => (
                <div key={idx} className="p-3 rounded bg-[#08080A] border border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#F5F2EB]">{t.teamName}</span>
                    <span className="font-mono text-[#D97706]">{t.academicYear}</span>
                  </div>
                  <div className="text-[11px] text-[#D6CFC2] mt-0.5">
                    {t.sportName} • {t.tournamentName}
                  </div>
                  {t.playingRole && (
                    <div className="text-[10px] text-[#8B8680] mt-0.5">Role: {t.playingRole}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rdr-panel rounded-lg p-5 space-y-3">
          <h2 className="font-editorial text-2xl flex items-center gap-2">
            <Award className="w-5 h-5 text-[#10B981]" /> Official Match Performances
          </h2>
          {matchStats.length === 0 ? (
            <p className="text-xs text-[#8B8680]">No verified match statistics recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {matchStats.map((s) => (
                <Link
                  key={s.matchId}
                  to={`/matches/${s.matchId}`}
                  className="block p-3 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/50"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#F5F2EB]">
                      {s.sportName} • {s.roundLabel}
                    </span>
                    {s.isMvp && (
                      <span className="px-2 py-0.5 rounded bg-[#D97706]/25 text-[#F59E0B] text-[10px] font-bold">
                        MVP
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(() => {
                      const raw = s.statsJson;
                      const sport = s.sportName.toLowerCase();
                      const chips: string[] = [];
                      if (sport.includes("cricket")) {
                        const runs = raw.runs ?? raw.battingRuns;
                        const balls = raw.balls ?? raw.ballsFaced;
                        const wickets = raw.wickets;
                        const conceded = raw.runsConceded ?? raw.conceded;
                        if (runs !== undefined) {
                          chips.push(balls !== undefined ? `Bat: ${runs} (${balls})` : `Bat: ${runs}`);
                        }
                        if (wickets !== undefined || conceded !== undefined) {
                          chips.push(`Bowl: ${wickets ?? 0}/${conceded ?? 0}`);
                        }
                      } else if (sport.includes("football")) {
                        if (raw.goals !== undefined) chips.push(`Goals: ${raw.goals}`);
                        if (raw.assists !== undefined) chips.push(`Assists: ${raw.assists}`);
                        if (raw.cleanSheet) chips.push("Clean Sheet");
                      } else if (
                        sport.includes("badminton") ||
                        sport.includes("volleyball") ||
                        sport.includes("table tennis") ||
                        sport.includes("throwball")
                      ) {
                        if (raw.points !== undefined) chips.push(`Pts: ${raw.points}`);
                        if (raw.setsWon !== undefined) chips.push(`Sets: ${raw.setsWon}`);
                        if (raw.aces !== undefined) chips.push(`Aces: ${raw.aces}`);
                      }
                      const finalChips =
                        chips.length > 0
                          ? chips
                          : Object.entries(raw ?? {})
                              .filter(([, v]) => v !== null && v !== undefined && v !== "")
                              .map(([k, v]) => {
                                const label = k
                                  .replace(/([A-Z])/g, " $1")
                                  .replace(/_/g, " ")
                                  .replace(/^./, (c) => c.toUpperCase())
                                  .trim();
                                return `${label}: ${String(v)}`;
                              });
                      return finalChips.length > 0 ? (
                        finalChips.map((chip, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-[#141418] border border-white/10 text-[11px] font-mono text-[#D6CFC2]"
                          >
                            {chip}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-[#8B8680]">Match appearance recorded</span>
                      );
                    })()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
