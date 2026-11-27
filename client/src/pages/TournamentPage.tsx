import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Edit3,
  Lock,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  Trash2,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";

interface SportItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  minSquadSize: number;
  maxSquadSize: number;
  registrationDeadline?: string | null;
  registrationOpen?: boolean;
}

interface DirectoryStudent {
  userId: number;
  playerProfileId: number;
  name: string;
  batch: string;
  branch: string | null;
  rollNumber: string | null;
}

interface RosterPlayer {
  playerProfileId: number;
  playingRole: string | null;
  playerClass: string;
  displayName: string;
  batch: string;
  branch: string | null;
}

interface TeamItem {
  id: number;
  sportId: number;
  name: string;
  shortCode: string;
  accentColor: string;
  captainUserId: number | null;
  submissionStatus: string;
  roster: RosterPlayer[];
}

interface StandingItem {
  teamId: number;
  sportId: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
  nrr: number;
  goalDiff: number;
  setsWon: number;
  setsLost: number;
  rank: number;
  team: TeamItem | null;
}

interface MatchItem {
  id: number;
  sportId: number;
  roundLabel: string;
  matchOrder?: number;
  venue: string;
  scheduledAt: string;
  status: "UPCOMING" | "LIVE" | "COMPLETED";
  scoreSummary: string | null;
  resultNote: string | null;
  verifiedBy: number | null;
  lineupAJson?: number[];
  lineupBJson?: number[];
  teamA: TeamItem | null;
  teamB: TeamItem | null;
  sport: SportItem | null;
}

interface CurrentTournamentResponse {
  tournament: {
    id: number;
    name: string;
    academicYear: number;
    semester: string;
    format: string;
    rosterMode: string;
    splitMode?: "COMBINED" | "SEPARATE_BOYS_GIRLS";
    status: string;
    description: string | null;
    startsAt?: string;
    endsAt?: string | null;
  } | null;
  sports: SportItem[];
  teams: TeamItem[];
  standings: StandingItem[];
  matches: MatchItem[];
  upcomingTournaments?: Array<{
    id: number;
    name: string;
    academicYear: number;
    semester: string;
    status: string;
    rosterMode: string;
  }>;
  allSports?: SportItem[];
  canManage: boolean;
}

export function TournamentPage() {
  const { user, notifyToast, refreshAll, sseVersion } = useApp();
  const [data, setData] = useState<CurrentTournamentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSportId, setSelectedSportId] = useState<number>(0);

  // Team Submission Modal (Searchable Multi-Select Student Picker)
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentBatchFilter, setStudentBatchFilter] = useState("");
  const [studentBranchFilter, setStudentBranchFilter] = useState("");
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [directory, setDirectory] = useState<DirectoryStudent[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<DirectoryStudent[]>([]);

  // Schedule / Edit Match Modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchItem | null>(null);
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState<MatchItem | null>(null);
  const [matchRound, setMatchRound] = useState("League Match");
  const [matchOrderInput, setMatchOrderInput] = useState(1);
  const [teamAId, setTeamAId] = useState<number>(0);
  const [teamBId, setTeamBId] = useState<number>(0);
  const [useCustomTeams, setUseCustomTeams] = useState(false);
  const [customTeamA, setCustomTeamA] = useState("");
  const [customTeamB, setCustomTeamB] = useState("");
  const [matchVenue, setMatchVenue] = useState("IIITT Main Ground");
  const [matchTime, setMatchTime] = useState("");

  // Match-Scoped Lineup Editor Modal
  const [squadMatch, setSquadMatch] = useState<MatchItem | null>(null);
  const [squadSide, setSquadSide] = useState<"A" | "B">("A");
  const [squadLineupA, setSquadLineupA] = useState<number[]>([]);
  const [squadLineupB, setSquadLineupB] = useState<number[]>([]);
  const [squadQuery, setSquadQuery] = useState("");
  const [squadBatchFilter, setSquadBatchFilter] = useState("");
  const [squadBranchFilter, setSquadBranchFilter] = useState("");
  const [squadDirectory, setSquadDirectory] = useState<DirectoryStudent[]>([]);
  const [squadBusy, setSquadBusy] = useState(false);

  // Empty-state Activate / Create Tournament state
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<number>(0);
  const [newTName, setNewTName] = useState("");
  const [newTYear, setNewTYear] = useState(new Date().getFullYear());
  const [newTRosterMode, setNewTRosterMode] = useState<"AUCTION" | "CAPTAIN_SUBMISSION">("AUCTION");
  const [newTSportIds, setNewTSportIds] = useState<number[]>([]);
  const [newTNotifyEveryone, setNewTNotifyEveryone] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  // Active Tournament Configuration Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [cfgName, setCfgName] = useState("");
  const [cfgFormat, setCfgFormat] = useState("GROUP_KNOCKOUT");
  const [cfgRosterMode, setCfgRosterMode] = useState<"AUCTION" | "CAPTAIN_SUBMISSION">("CAPTAIN_SUBMISSION");
  const [cfgSplitMode, setCfgSplitMode] = useState<"COMBINED" | "SEPARATE_BOYS_GIRLS">("COMBINED");
  const [cfgDescription, setCfgDescription] = useState("");
  const [cfgStartsAt, setCfgStartsAt] = useState("");
  const [cfgEndsAt, setCfgEndsAt] = useState("");
  const [cfgSports, setCfgSports] = useState<
    Array<{
      sportId: number;
      enabled: boolean;
      name: string;
      minSquadSize: number;
      maxSquadSize: number;
      registrationDeadline: string;
    }>
  >([]);
  const [cfgNotifyEveryone, setCfgNotifyEveryone] = useState(false);
  const [cfgBusy, setCfgBusy] = useState(false);

  const loadTournament = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch<CurrentTournamentResponse>("/api/tournaments/current");
      setData(res);
      if (res.sports.length > 0) {
        setSelectedSportId((prev) => prev || res.sports[0].id);
      }
      if (res.upcomingTournaments && res.upcomingTournaments.length > 0) {
        setSelectedUpcomingId((prev) => prev || res.upcomingTournaments![0].id);
      }
      if (res.allSports && res.allSports.length > 0) {
        setNewTSportIds((prev) => (prev.length > 0 ? prev : res.allSports!.slice(0, 4).map((s) => s.id)));
      }
    } catch (err) {
      const msg = (err as Error).message || "Failed to load current tournament.";
      setLoadError(msg);
      notifyToast("error", msg);
    }
  }, [notifyToast]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament, sseVersion, user?.id]);

  useEffect(() => {
    const anyModalOpen =
      showTeamModal || showMatchModal || Boolean(squadMatch) || Boolean(confirmDeleteMatch) || showConfigModal;
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTeamModal(false);
        setShowMatchModal(false);
        setEditingMatch(null);
        setSquadMatch(null);
        setConfirmDeleteMatch(null);
        setShowConfigModal(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showTeamModal, showMatchModal, squadMatch, confirmDeleteMatch, showConfigModal]);

  useEffect(() => {
    if (!showTeamModal && !squadMatch) return;
    let cancelled = false;
    const q = showTeamModal ? studentQuery : squadQuery;
    const batch = showTeamModal ? studentBatchFilter : squadBatchFilter;
    const branch = showTeamModal ? studentBranchFilter : squadBranchFilter;
    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (batch) params.set("batch", batch);
        if (branch) params.set("branch", branch);
        const res = await apiFetch<{
          students: DirectoryStudent[];
          batches?: string[];
          branches?: string[];
        }>(`/api/roles/directory?${params.toString()}`);
        if (!cancelled) {
          setDirectory(res.students);
          setSquadDirectory(res.students);
          if (res.batches) setAvailableBatches(res.batches);
          if (res.branches) setAvailableBranches(res.branches);
        }
      } catch (err) {
        if (!cancelled) {
          notifyToast("error", (err as Error).message || "Failed to search students.");
        }
      } finally {
        if (!cancelled) setSearchingStudents(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    showTeamModal,
    squadMatch,
    studentQuery,
    studentBatchFilter,
    studentBranchFilter,
    squadQuery,
    squadBatchFilter,
    squadBranchFilter,
  ]);

  const openTeamModal = () => {
    setStudentQuery("");
    setStudentBatchFilter("");
    setStudentBranchFilter("");
    setShowTeamModal(true);
  };

  const toggleStudentSelection = (st: DirectoryStudent) => {
    setSelectedPlayers((prev) => {
      const exists = prev.some((p) => p.playerProfileId === st.playerProfileId);
      if (exists) {
        return prev.filter((p) => p.playerProfileId !== st.playerProfileId);
      }
      const max = selectedSport?.maxSquadSize ?? 15;
      if (prev.length >= max) {
        notifyToast("error", `Maximum squad size (${max}) reached.`);
        return prev;
      }
      return [...prev, st];
    });
  };

  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.tournament) return;
    try {
      await apiFetch(`/api/tournaments/${data.tournament.id}/teams`, {
        method: "POST",
        body: JSON.stringify({
          ...(editingTeamId ? { teamId: editingTeamId } : {}),
          sportId: selectedSportId,
          name: teamName,
          shortCode: teamCode,
          playerProfileIds: selectedPlayers.map((p) => p.playerProfileId),
          submitImmediately: true,
        }),
      });
      setShowTeamModal(false);
      setEditingTeamId(null);
      setTeamName("");
      setTeamCode("");
      setSelectedPlayers([]);
      setStudentQuery("");
      await loadTournament();
      notifyToast("success", "Team roster submitted for Sports Secretary approval.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleArchiveTournament = async () => {
    if (!data?.tournament) return;
    try {
      await apiFetch(`/api/tournaments/${data.tournament.id}/archive`, { method: "POST" });
      await loadTournament();
      await refreshAll();
      notifyToast("success", "Tournament archived and tournament-scoped captaincy closed.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleReviewTeam = async (
    teamId: number,
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "LOCKED"
  ) => {
    try {
      await apiFetch(`/api/tournaments/teams/${teamId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      await loadTournament();
      notifyToast("success", `Team marked ${decision}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleActivateUpcoming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUpcomingId) return;
    setLifecycleBusy(true);
    try {
      await apiFetch(`/api/tournaments/${selectedUpcomingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CURRENT" }),
      });
      await Promise.all([loadTournament(), refreshAll()]);
      notifyToast("success", "Tournament activated as Current Tournament!");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleCreateAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTName.trim() || newTSportIds.length === 0) {
      notifyToast("error", "Enter a tournament name and select at least one sport.");
      return;
    }
    setLifecycleBusy(true);
    try {
      await apiFetch("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: newTName.trim(),
          academicYear: Number(newTYear),
          semester: "EVEN",
          tournamentType: newTRosterMode === "AUCTION" ? "PROTHYMOS" : "FLAGSHIP",
          format: "GROUP_KNOCKOUT",
          rosterMode: newTRosterMode,
          startsAt: new Date().toISOString(),
          sportIds: newTSportIds,
          setAsCurrent: true,
          notifyEveryone: newTNotifyEveryone,
        }),
      });
      setNewTName("");
      setNewTNotifyEveryone(false);
      await Promise.all([loadTournament(), refreshAll()]);
      notifyToast(
        "success",
        newTNotifyEveryone
          ? "New tournament created, activated, and everyone notified!"
          : "New tournament created & activated!"
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setLifecycleBusy(false);
    }
  };

  const openEditMatchModal = (m: MatchItem) => {
    setEditingMatch(m);
    setUseCustomTeams(false);
    setMatchRound(m.roundLabel);
    setMatchOrderInput(m.matchOrder ?? 1);
    setTeamAId(m.teamA?.id ?? approvedSportTeams[0]?.id ?? 0);
    setTeamBId(m.teamB?.id ?? approvedSportTeams[1]?.id ?? 0);
    setMatchVenue(m.venue);
    const localDt = new Date(new Date(m.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setMatchTime(localDt);
    setShowMatchModal(true);
  };

  const handleDeleteMatch = (m: MatchItem) => {
    setConfirmDeleteMatch(m);
  };

  const confirmAndDeleteMatch = async () => {
    if (!confirmDeleteMatch) return;
    try {
      await apiFetch(`/api/matches/${confirmDeleteMatch.id}`, { method: "DELETE" });
      setConfirmDeleteMatch(null);
      await loadTournament();
      notifyToast("success", "Match deleted.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const openConfigModal = () => {
    if (!data?.tournament) return;
    const t = data.tournament;
    setCfgName(t.name);
    setCfgFormat(t.format);
    setCfgRosterMode(t.rosterMode === "AUCTION" ? "AUCTION" : "CAPTAIN_SUBMISSION");
    setCfgSplitMode(t.splitMode ?? "COMBINED");
    setCfgDescription(t.description ?? "");
    const toLocalDt = (iso?: string | null) => {
      if (!iso) return "";
      return new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    setCfgStartsAt(toLocalDt(t.startsAt ?? new Date().toISOString()));
    setCfgEndsAt(toLocalDt(t.endsAt));
    const configuredById = new Map(data.sports.map((s) => [s.id, s]));
    const catalog = data.allSports && data.allSports.length > 0 ? data.allSports : data.sports;
    setCfgSports(
      catalog.map((s) => {
        const active = configuredById.get(s.id);
        return {
          sportId: s.id,
          enabled: Boolean(active),
          name: s.name,
          minSquadSize: active?.minSquadSize ?? s.minSquadSize ?? 1,
          maxSquadSize: active?.maxSquadSize ?? s.maxSquadSize ?? 15,
          registrationDeadline: toLocalDt(active?.registrationDeadline),
        };
      })
    );
    setCfgNotifyEveryone(false);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.tournament) return;
    const enabledSports = cfgSports.filter((s) => s.enabled);
    if (enabledSports.length === 0) {
      notifyToast("error", "Select at least one sport for the tournament.");
      return;
    }
    setCfgBusy(true);
    try {
      await apiFetch(`/api/tournaments/${data.tournament.id}/config`, {
        method: "PATCH",
        body: JSON.stringify({
          name: cfgName.trim(),
          format: cfgFormat,
          rosterMode: cfgRosterMode,
          splitMode: cfgSplitMode,
          description: cfgDescription.trim() || null,
          startsAt: cfgStartsAt ? new Date(cfgStartsAt).toISOString() : new Date().toISOString(),
          endsAt: cfgEndsAt ? new Date(cfgEndsAt).toISOString() : null,
          sportsConfig: enabledSports.map((s) => ({
            sportId: s.sportId,
            minSquadSize: Number(s.minSquadSize) || 1,
            maxSquadSize: Number(s.maxSquadSize) || 15,
            registrationDeadline: s.registrationDeadline
              ? new Date(s.registrationDeadline).toISOString()
              : null,
          })),
          notifyEveryone: cfgNotifyEveryone,
        }),
      });
      setShowConfigModal(false);
      await Promise.all([loadTournament(), refreshAll()]);
      notifyToast(
        "success",
        cfgNotifyEveryone
          ? "Tournament structure saved and everyone notified!"
          : "Tournament configuration updated."
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setCfgBusy(false);
    }
  };

  const openSquadModal = (m: MatchItem) => {
    setSquadMatch(m);
    setSquadSide("A");
    const defaultA = (m.lineupAJson && m.lineupAJson.length > 0)
      ? m.lineupAJson
      : (m.teamA?.roster ?? []).map((r) => r.playerProfileId);
    const defaultB = (m.lineupBJson && m.lineupBJson.length > 0)
      ? m.lineupBJson
      : (m.teamB?.roster ?? []).map((r) => r.playerProfileId);
    setSquadLineupA(defaultA);
    setSquadLineupB(defaultB);
    setSquadQuery("");
    setSquadBatchFilter("");
    setSquadBranchFilter("");
  };

  const handleToggleSquadMember = async (
    playerProfileId: number,
    action: "ADD" | "REMOVE"
  ) => {
    if (!squadMatch) return;
    setSquadBusy(true);
    try {
      const nextList =
        squadSide === "A"
          ? action === "ADD"
            ? Array.from(new Set([...squadLineupA, playerProfileId]))
            : squadLineupA.filter((id) => id !== playerProfileId)
          : action === "ADD"
          ? Array.from(new Set([...squadLineupB, playerProfileId]))
          : squadLineupB.filter((id) => id !== playerProfileId);

      await apiFetch(`/api/matches/${squadMatch.id}/lineup`, {
        method: "PATCH",
        body: JSON.stringify({
          side: squadSide,
          playerProfileIds: nextList,
          overrideReason: "Match-scoped squad edit by Sports Secretary",
        }),
      });
      if (squadSide === "A") setSquadLineupA(nextList);
      else setSquadLineupB(nextList);
      await loadTournament();
      notifyToast("success", "Match-scoped lineup updated (tournament roster unchanged).");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSquadBusy(false);
    }
  };

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.tournament) return;
    try {
      if (editingMatch) {
        await apiFetch(`/api/matches/${editingMatch.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            roundLabel: matchRound,
            matchOrder: Number(matchOrderInput) || 1,
            teamAId,
            teamBId,
            venue: matchVenue,
            scheduledAt: new Date(matchTime).toISOString(),
          }),
        });
        setShowMatchModal(false);
        setEditingMatch(null);
        await loadTournament();
        notifyToast("success", "Match schedule updated.");
        return;
      }

      await apiFetch(`/api/tournaments/${data.tournament.id}/matches`, {
        method: "POST",
        body: JSON.stringify({
          sportId: selectedSportId,
          roundLabel: matchRound,
          matchOrder: Number(matchOrderInput) || 1,
          ...(useCustomTeams
            ? { customTeamAName: customTeamA.trim(), customTeamBName: customTeamB.trim() }
            : { teamAId, teamBId }),
          venue: matchVenue,
          scheduledAt: new Date(matchTime).toISOString(),
        }),
      });
      setShowMatchModal(false);
      setCustomTeamA("");
      setCustomTeamB("");
      await loadTournament();
      notifyToast("success", "Match scheduled.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  if (loadError && !data) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="rdr-panel rounded-lg p-6 border border-[#DC2626]/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#FCA5A5]">{loadError}</span>
          <button
            type="button"
            onClick={loadTournament}
            className="px-3.5 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase text-[#F5F2EB]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-7xl mx-auto p-8 text-sm text-[#8B8680]">Loading Current Tournament...</div>;
  }

  const formatMatchSummary = (m: MatchItem): string | null => {
    const raw = (m.scoreSummary ?? "").trim();
    const isPlaceholder = raw.toLowerCase() === "scheduled" || raw.toLowerCase() === "kickoff scheduled";
    if (m.status === "LIVE") {
      return raw && !isPlaceholder ? raw : "Match In Progress";
    }
    if (m.status === "COMPLETED") {
      return raw && !isPlaceholder ? raw : m.resultNote || "Completed — Final Score";
    }
    return raw || null;
  };

  if (!data.tournament) {
    const upcomingList = data.upcomingTournaments ?? [];
    const sportsOptions = data.allSports ?? [];
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rdr-panel rounded-lg p-8 text-center space-y-2 border border-white/10">
          <Trophy className="w-8 h-8 text-[#D97706] mx-auto" />
          <h1 className="font-editorial text-3xl text-[#F5F2EB]">No Active Flagship Tournament</h1>
          <p className="text-xs text-[#8B8680]">
            Check <Link to="/overview" className="text-[#D97706] hover:underline">Overview</Link> for upcoming semester dates or browse the{" "}
            <Link to="/archive" className="text-[#D97706] hover:underline">Sports Archive</Link>.
          </p>
        </div>

        {data.canManage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleActivateUpcoming} className="rdr-panel rdr-border-crimson rounded-lg p-6 space-y-4 text-xs">
              <h2 className="font-editorial text-2xl text-[#D97706]">Activate Upcoming Tournament</h2>
              {upcomingList.length === 0 ? (
                <p className="text-[#8B8680]">No upcoming or paused tournaments found. Create one on the right.</p>
              ) : (
                <>
                  <select
                    value={selectedUpcomingId}
                    onChange={(e) => setSelectedUpcomingId(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  >
                    {upcomingList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.academicYear} · {t.status} · {t.rosterMode})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={lifecycleBusy || !selectedUpcomingId}
                    className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase disabled:opacity-50"
                  >
                    {lifecycleBusy ? "Activating..." : "Activate Tournament"}
                  </button>
                </>
              )}
            </form>

            <form onSubmit={handleCreateAndActivate} className="rdr-panel rounded-lg p-6 space-y-3 text-xs">
              <h2 className="font-editorial text-2xl text-[#F5F2EB]">Create &amp; Activate New Tournament</h2>
              <div>
                <label className="text-[#D6CFC2] block mb-1">Tournament Name</label>
                <input
                  required
                  value={newTName}
                  onChange={(e) => setNewTName(e.target.value)}
                  placeholder="e.g., Prothymos 2027 Championship"
                  className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Academic Year</label>
                  <input
                    type="number"
                    value={newTYear}
                    onChange={(e) => setNewTYear(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Roster Mode</label>
                  <select
                    value={newTRosterMode}
                    onChange={(e) => setNewTRosterMode(e.target.value as typeof newTRosterMode)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  >
                    <option value="AUCTION">AUCTION (Prothymos)</option>
                    <option value="CAPTAIN_SUBMISSION">CAPTAIN_SUBMISSION</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#D6CFC2] block mb-1">Included Sports</label>
                <div className="flex flex-wrap gap-1.5">
                  {sportsOptions.map((sp) => {
                    const checked = newTSportIds.includes(sp.id);
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          setNewTSportIds((prev) =>
                            checked ? prev.filter((id) => id !== sp.id) : [...prev, sp.id]
                          )
                        }
                        className={`px-2 py-1 rounded border text-[11px] font-semibold ${
                          checked
                            ? "bg-[#B91C1C]/30 border-[#DC2626] text-[#F5F2EB]"
                            : "bg-[#08080A] border-white/15 text-[#8B8680]"
                        }`}
                      >
                        {checked ? "✓ " : ""}
                        {sp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#D6CFC2] cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={newTNotifyEveryone}
                  onChange={(e) => setNewTNotifyEveryone(e.target.checked)}
                  className="accent-[#D97706]"
                />
                <span>Notify everyone via in-app notification</span>
              </label>
              <button
                type="submit"
                disabled={lifecycleBusy}
                className="px-4 py-2 rounded bg-[#10B981] hover:bg-[#059669] text-[#08080A] font-bold uppercase disabled:opacity-50"
              >
                {lifecycleBusy ? "Creating..." : "Create & Activate Tournament"}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const { tournament, sports, teams, standings, matches, canManage } = data;
  const activeLiveMatches = matches.filter((m) => m.status === "LIVE");
  const selectedSport = sports.find((s) => s.id === selectedSportId) ?? sports[0];
  const sportStandings = standings.filter((s) => s.sportId === selectedSport?.id);
  const sportMatches = matches.filter((m) => m.sportId === selectedSport?.id);
  const sportTeams = teams.filter((t) => t.sportId === selectedSport?.id);
  const approvedSportTeams = sportTeams.filter(
    (t) => t.submissionStatus === "APPROVED" || t.submissionStatus === "LOCKED"
  );
  const alreadySubmittedForSport = Boolean(
    user &&
      sportTeams.some(
        (t) => t.captainUserId === user.id && t.submissionStatus !== "REJECTED"
      )
  );
  const canOpenRosterSubmission =
    Boolean(user) &&
    tournament.status === "ACTIVE" &&
    tournament.rosterMode === "CAPTAIN_SUBMISSION" &&
    selectedSport?.registrationOpen !== false &&
    (!alreadySubmittedForSport || canManage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#D6CFC2]/15 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            {tournament.academicYear} • {tournament.semester} Semester Flagship
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB] mt-1">
            {tournament.name}
          </h1>
          {tournament.description && (
            <p className="text-xs text-[#D6CFC2] mt-1 max-w-2xl">{tournament.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tournament.rosterMode === "CAPTAIN_SUBMISSION" && user && (
            canOpenRosterSubmission ? (
              <button
                type="button"
                onClick={openTeamModal}
                className="px-3.5 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Submit Team Roster
              </button>
            ) : (
              <span className="px-3 py-2 rounded bg-[#141418] border border-white/15 text-[11px] text-[#8B8680]">
                {alreadySubmittedForSport
                  ? `Roster already submitted for ${selectedSport?.name}`
                  : `Registration closed for ${selectedSport?.name}`}
              </span>
            )
          )}
          {canManage && (
            <button
              type="button"
              onClick={openConfigModal}
              className="px-3.5 py-2 rounded bg-[#141418] border border-white/15 hover:border-[#D97706]/60 text-xs font-bold uppercase tracking-wider text-[#F5F2EB] flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-[#D97706]" /> Configure Tournament
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setMatchRound("League Match");
                setMatchOrderInput(sportMatches.length + 1);
                const hasTeams = approvedSportTeams.length >= 2;
                setUseCustomTeams(!hasTeams);
                if (hasTeams) {
                  setTeamAId(approvedSportTeams[0].id);
                  setTeamBId(approvedSportTeams[1].id);
                }
                setShowMatchModal(true);
              }}
              className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 text-xs font-bold uppercase tracking-wider text-[#D97706]"
            >
              + Schedule Match
            </button>
          )}
          {canManage && tournament.status === "ACTIVE" && (
            <button
              type="button"
              onClick={handleArchiveTournament}
              className="px-3.5 py-2 rounded bg-[#141418] border border-white/15 hover:border-[#DC2626] text-xs font-bold uppercase tracking-wider text-[#D6CFC2]"
            >
              Complete &amp; Archive
            </button>
          )}
        </div>
      </div>

      {/* ALL Active Live Matches Strip */}
      {activeLiveMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#DC2626]">
            <Radio className="w-4 h-4 animate-pulse" /> All Live Matches Right Now ({activeLiveMatches.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLiveMatches.map((m) => (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="rdr-panel rdr-border-crimson rounded-lg p-4 hover:border-[#F59E0B] transition space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-[#D97706]">
                    {m.sport?.name} • {m.roundLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#DC2626] text-[#F5F2EB] text-[10px] font-bold animate-pulse">
                    LIVE
                  </span>
                </div>
                <div className="text-sm font-bold text-[#F5F2EB]">
                  {m.teamA?.name} <span className="text-[#8B8680]">vs</span> {m.teamB?.name}
                </div>
                <div className="font-mono tabular-nums text-sm text-[#F59E0B] bg-[#08080A] px-2.5 py-1.5 rounded border border-white/10">
                  {formatMatchSummary(m) || "Match In Progress"}
                </div>
                <div className="text-[11px] text-[#8B8680] flex items-center justify-between">
                  <span>{m.venue}</span>
                  <span className="text-[#D6CFC2] flex items-center gap-0.5">
                    Full Scorecard <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sport Selector Bar */}
      <section className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {sports.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSportId(s.id)}
              className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                selectedSport?.id === s.id
                  ? "bg-[#B91C1C] text-[#F5F2EB] shadow"
                  : "bg-[#141418] text-[#D6CFC2] border border-white/10 hover:border-[#D97706]/50"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Selected Sport: Points Table + Past/Scheduled Matches */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Points Table */}
          <div className="lg:col-span-2 rdr-panel rounded-lg p-5 space-y-4">
            <h2 className="font-editorial text-2xl text-[#F5F2EB]">
              {selectedSport?.name} Points Table
            </h2>
            {sportStandings.length === 0 ? (
              <p className="text-xs text-[#8B8680] py-4">
                Points table populates automatically as matches are completed and verified.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[#8B8680] border-b border-white/10 uppercase">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Team</th>
                      <th className="py-2 px-2 text-center">P</th>
                      <th className="py-2 px-2 text-center">W</th>
                      <th className="py-2 px-2 text-center">L</th>
                      <th className="py-2 px-2 text-center">D</th>
                      <th className="py-2 px-2 text-right">
                        {selectedSport?.slug === "cricket"
                          ? "NRR"
                          : selectedSport?.slug === "football"
                          ? "GD"
                          : "Sets"}
                      </th>
                      <th className="py-2 pl-2 text-right text-[#D97706]">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sportStandings.map((row) => (
                      <tr key={row.teamId} className="hover:bg-white/5 tabular-nums">
                        <td className="py-2.5 pr-3 font-mono text-[#D97706]">{row.rank}</td>
                        <td className="py-2.5 pr-3 font-semibold text-[#F5F2EB]">
                          {row.team?.name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{row.played}</td>
                        <td className="py-2.5 px-2 text-center font-mono text-[#10B981]">{row.won}</td>
                        <td className="py-2.5 px-2 text-center font-mono text-[#DC2626]">{row.lost}</td>
                        <td className="py-2.5 px-2 text-center font-mono">{row.drawn}</td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          {selectedSport?.slug === "cricket"
                            ? row.nrr.toFixed(3)
                            : selectedSport?.slug === "football"
                            ? row.goalDiff
                            : `${row.setsWon}-${row.setsLost}`}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono font-bold text-[#F59E0B]">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Matches List (Clickable to Scorecard) */}
          <div className="rdr-panel rounded-lg p-5 space-y-4">
            <h2 className="font-editorial text-2xl text-[#F5F2EB]">
              {selectedSport?.name} Fixtures &amp; Results
            </h2>
            {sportMatches.length === 0 ? (
              <p className="text-xs text-[#8B8680]">No matches scheduled for this sport yet.</p>
            ) : (
              <div className="space-y-2.5">
                {sportMatches.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/60 space-y-2"
                  >
                    <Link to={`/matches/${m.id}`} className="block space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#D97706] font-bold uppercase">{m.roundLabel}</span>
                        <span
                          className={`font-bold ${
                            m.status === "LIVE"
                              ? "text-[#DC2626]"
                              : m.status === "COMPLETED"
                              ? "text-[#10B981]"
                              : "text-[#8B8680]"
                          }`}
                        >
                          {m.status} {m.verifiedBy ? "✓" : ""}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#F5F2EB]">
                        {m.teamA?.shortCode} vs {m.teamB?.shortCode}
                      </div>
                      {formatMatchSummary(m) && (
                        <div className="text-[11px] font-mono tabular-nums text-[#D6CFC2]">
                          {formatMatchSummary(m)}
                        </div>
                      )}
                      <div className="text-[10px] text-[#8B8680] tabular-nums">{formatIST(m.scheduledAt)}</div>
                    </Link>

                    {canManage && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/10 text-[10px]">
                        <button
                          type="button"
                          onClick={() => openEditMatchModal(m)}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-[#D97706]/25 text-[#D6CFC2] hover:text-[#F59E0B] font-semibold flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openSquadModal(m)}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-[#10B981]/20 text-[#D6CFC2] hover:text-[#10B981] font-semibold flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" /> Edit Match Squad
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMatch(m)}
                          className="px-2 py-1 rounded bg-[#DC2626]/20 hover:bg-[#DC2626]/40 text-[#FCA5A5] font-semibold flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Teams & Account-Linked Rosters */}
        <div className="rdr-panel rounded-lg p-5 space-y-4">
          <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D97706]" /> {selectedSport?.name} Teams &amp; Squads
          </h2>
          {sportTeams.length === 0 ? (
            <p className="text-xs text-[#8B8680]">No teams submitted for {selectedSport?.name} yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sportTeams.map((team) => (
                <div key={team.id} className="p-4 rounded bg-[#08080A] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div>
                      <div className="text-sm font-bold text-[#F5F2EB]">{team.name}</div>
                      <div className="text-[10px] font-mono text-[#D97706]">{team.shortCode}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold">
                      {team.submissionStatus}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {team.roster.map((p) => (
                      <Link
                        key={p.playerProfileId}
                        to={`/players/${p.playerProfileId}`}
                        className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-white/5"
                      >
                        <span className="text-[#F5F2EB] hover:text-[#D97706]">{p.displayName}</span>
                        <span className="text-[10px] text-[#8B8680]">
                          {p.playingRole ?? p.batch}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {user &&
                    team.captainUserId === user.id &&
                    (team.submissionStatus === "DRAFT" || team.submissionStatus === "CHANGES_REQUESTED") && (
                      <div className="pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeamId(team.id);
                            setTeamName(team.name);
                            setTeamCode(team.shortCode);
                            setSelectedPlayers(
                              team.roster.map((p) => ({
                                playerProfileId: p.playerProfileId,
                                userId: 0,
                                name: p.displayName,
                                displayName: p.displayName,
                                rollNumber: null,
                                batch: p.batch,
                                branch: "",
                              }))
                            );
                            setShowTeamModal(true);
                          }}
                          className="w-full py-1.5 rounded bg-[#D97706] hover:bg-[#F59E0B] text-[#08080A] text-[11px] font-bold uppercase"
                        >
                          Edit &amp; Resubmit Squad
                        </button>
                      </div>
                    )}

                  {canManage && team.submissionStatus === "SUBMITTED" && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleReviewTeam(team.id, "APPROVED")}
                        className="flex-1 py-1.5 px-2 rounded bg-[#10B981] text-[#08080A] text-[11px] font-bold uppercase flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewTeam(team.id, "CHANGES_REQUESTED")}
                        className="flex-1 py-1.5 px-2 rounded bg-white/10 hover:bg-[#D97706]/25 text-[11px] font-semibold flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewTeam(team.id, "REJECTED")}
                        className="py-1.5 px-2 rounded bg-[#DC2626]/20 hover:bg-[#DC2626]/35 text-[#FCA5A5] text-[11px] font-semibold flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                  {canManage && team.submissionStatus === "APPROVED" && (
                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleReviewTeam(team.id, "LOCKED")}
                        className="w-full py-1.5 rounded bg-[#08080A] border border-white/15 hover:border-[#D97706]/60 text-[11px] font-semibold text-[#D6CFC2] flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3 h-3 text-[#D97706]" /> Lock Squad
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Captain Team Submission Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-lg w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl">Submit {selectedSport?.name} Team Roster</h3>
            <form onSubmit={handleSubmitTeam} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-[#D6CFC2] block mb-1">Team Name</label>
                  <input
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g., Amaravathi Aces"
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Short Code</label>
                  <input
                    required
                    maxLength={5}
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value)}
                    placeholder="AMA"
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#D6CFC2]">
                  <span>Search &amp; Select IIITT Students</span>
                  <span className="font-mono text-[11px] text-[#D97706]">
                    {selectedPlayers.length} selected · min {selectedSport?.minSquadSize ?? 1} / max{" "}
                    {selectedSport?.maxSquadSize ?? 15}
                  </span>
                </div>

                {/* Selected Players Removable Chips */}
                {selectedPlayers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded bg-[#08080A] border border-[#D97706]/30 max-h-28 overflow-y-auto">
                    {selectedPlayers.map((p) => (
                      <span
                        key={p.playerProfileId}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#B91C1C]/25 border border-[#B91C1C]/60 text-[11px] text-[#F5F2EB]"
                      >
                        <span>
                          {p.name} ({p.rollNumber ?? p.batch})
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleStudentSelection(p)}
                          aria-label={`Remove ${p.name}`}
                          className="text-[#D6CFC2] hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search Input & Batch/Branch Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="relative sm:col-span-2">
                    <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Search name, roll, batch, branch..."
                      className="w-full bg-[#08080A] border border-white/15 rounded pl-8 pr-3 py-2 text-xs"
                    />
                  </div>
                  <select
                    value={studentBatchFilter}
                    onChange={(e) => setStudentBatchFilter(e.target.value)}
                    aria-label="Filter by batch"
                    className="bg-[#08080A] border border-white/15 rounded px-2 py-2 text-xs"
                  >
                    <option value="">All Batches</option>
                    {availableBatches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={studentBranchFilter}
                    onChange={(e) => setStudentBranchFilter(e.target.value)}
                    aria-label="Filter by branch"
                    className="bg-[#08080A] border border-white/15 rounded px-2 py-2 text-xs"
                  >
                    <option value="">All Branches</option>
                    {availableBranches.map((br) => (
                      <option key={br} value={br}>
                        {br}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Results */}
                <div className="max-h-48 overflow-y-auto bg-[#08080A] border border-white/15 rounded p-1.5 space-y-1">
                  {searchingStudents ? (
                    <div className="text-xs text-[#8B8680] p-2 text-center">Searching students...</div>
                  ) : directory.length === 0 ? (
                    <div className="text-xs text-[#8B8680] p-2 text-center">
                      No matching students found.
                    </div>
                  ) : (
                    directory.map((st) => {
                      const checked = selectedPlayers.some(
                        (p) => p.playerProfileId === st.playerProfileId
                      );
                      return (
                        <button
                          key={st.playerProfileId}
                          type="button"
                          onClick={() => toggleStudentSelection(st)}
                          className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-2 rounded transition ${
                            checked
                              ? "bg-[#10B981]/15 border border-[#10B981]/50 text-[#F5F2EB]"
                              : "hover:bg-white/5 border border-transparent text-[#D6CFC2]"
                          }`}
                        >
                          <span className="font-medium">
                            {checked ? "✓ " : "+ "}
                            {st.name}
                          </span>
                          <span className="font-mono text-[10px] text-[#8B8680]">
                            {st.rollNumber ?? st.batch} · {st.batch} {st.branch ?? ""}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTeamModal(false)} className="px-3 py-1.5 rounded bg-white/10 text-xs">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase">
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule / Edit Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#D97706]" />{" "}
              {editingMatch ? `Edit ${selectedSport?.name} Match` : `Schedule ${selectedSport?.name} Match`}
            </h3>
            <form onSubmit={handleScheduleMatch} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-[#D6CFC2] block mb-1">Stage / Round Label</label>
                  <input
                    required
                    value={matchRound}
                    onChange={(e) => setMatchRound(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Order</label>
                  <input
                    type="number"
                    min={1}
                    value={matchOrderInput}
                    onChange={(e) => setMatchOrderInput(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              {!editingMatch && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8B8680]">
                    {approvedSportTeams.length >= 2
                      ? "Select from synced tournament teams or enter custom names."
                      : "Fewer than 2 approved teams synced — enter custom team names."}
                  </span>
                  {approvedSportTeams.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => setUseCustomTeams((v) => !v)}
                      className="text-[#D97706] hover:underline font-semibold"
                    >
                      {useCustomTeams ? "Use Synced Teams" : "Custom Names"}
                    </button>
                  )}
                </div>
              )}
              {useCustomTeams ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Team A Name</label>
                    <input
                      required
                      value={customTeamA}
                      onChange={(e) => setCustomTeamA(e.target.value)}
                      placeholder="e.g., Trichy Titans"
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Team B Name</label>
                    <input
                      required
                      value={customTeamB}
                      onChange={(e) => setCustomTeamB(e.target.value)}
                      placeholder="e.g., Cauvery Chargers"
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Team A</label>
                    <select
                      value={teamAId}
                      onChange={(e) => setTeamAId(Number(e.target.value))}
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      {approvedSportTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.shortCode})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Team B</label>
                    <select
                      value={teamBId}
                      onChange={(e) => setTeamBId(Number(e.target.value))}
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      {approvedSportTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.shortCode})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[#D6CFC2] block mb-1">Venue</label>
                <input
                  required
                  value={matchVenue}
                  onChange={(e) => setMatchVenue(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-[#D6CFC2] block mb-1">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={matchTime}
                  onChange={(e) => setMatchTime(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchModal(false);
                    setEditingMatch(null);
                  }}
                  className="px-3 py-1.5 rounded bg-white/10 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase">
                  {editingMatch ? "Save Match" : "Create Fixture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match-Scoped Lineup Editor Modal */}
      {squadMatch && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <h3 className="font-editorial text-2xl text-[#F5F2EB]">
                  Edit Match Squad — {squadMatch.roundLabel}
                </h3>
                <p className="text-[11px] text-[#8B8680]">
                  Changes apply ONLY to this fixture ({squadMatch.teamA?.shortCode} vs {squadMatch.teamB?.shortCode}); overall tournament rosters stay untouched.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSquadMatch(null)}
                className="text-[#8B8680] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSquadSide("A")}
                className={`flex-1 py-2 rounded font-bold uppercase ${
                  squadSide === "A"
                    ? "bg-[#B91C1C] text-[#F5F2EB]"
                    : "bg-[#08080A] border border-white/15 text-[#D6CFC2]"
                }`}
              >
                {squadMatch.teamA?.name ?? "Team A"} ({squadLineupA.length})
              </button>
              <button
                type="button"
                onClick={() => setSquadSide("B")}
                className={`flex-1 py-2 rounded font-bold uppercase ${
                  squadSide === "B"
                    ? "bg-[#B91C1C] text-[#F5F2EB]"
                    : "bg-[#08080A] border border-white/15 text-[#D6CFC2]"
                }`}
              >
                {squadMatch.teamB?.name ?? "Team B"} ({squadLineupB.length})
              </button>
            </div>

            {/* Active Match-Scoped Lineup */}
            <div className="space-y-2 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-[#D97706] font-bold">
                Current Match Lineup ({squadSide === "A" ? squadMatch.teamA?.shortCode : squadMatch.teamB?.shortCode})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(squadSide === "A" ? squadLineupA : squadLineupB).map((pid) => {
                  const fromRoster =
                    (squadSide === "A" ? squadMatch.teamA?.roster : squadMatch.teamB?.roster)?.find(
                      (r) => r.playerProfileId === pid
                    ) ??
                    squadDirectory.find((d) => d.playerProfileId === pid);
                  const label =
                    fromRoster && "displayName" in fromRoster
                      ? fromRoster.displayName
                      : fromRoster && "name" in fromRoster
                      ? fromRoster.name
                      : `Player #${pid}`;
                  return (
                    <span
                      key={pid}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/50 text-[#F5F2EB]"
                    >
                      {label}
                      <button
                        type="button"
                        disabled={squadBusy}
                        onClick={() => handleToggleSquadMember(pid, "REMOVE")}
                        className="text-[#FCA5A5] hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {(squadSide === "A" ? squadLineupA : squadLineupB).length === 0 && (
                  <span className="text-[#8B8680]">No players in match lineup yet.</span>
                )}
              </div>
            </div>

            {/* Searchable Student & Roster Picker */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="relative sm:col-span-2">
                  <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={squadQuery}
                    onChange={(e) => setSquadQuery(e.target.value)}
                    placeholder="Search students to add..."
                    className="w-full bg-[#08080A] border border-white/15 rounded pl-8 pr-3 py-2 text-xs"
                  />
                </div>
                <select
                  value={squadBatchFilter}
                  onChange={(e) => setSquadBatchFilter(e.target.value)}
                  aria-label="Filter squad candidates by batch"
                  className="bg-[#08080A] border border-white/15 rounded px-2 py-2 text-xs"
                >
                  <option value="">All Batches</option>
                  {availableBatches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={squadBranchFilter}
                  onChange={(e) => setSquadBranchFilter(e.target.value)}
                  aria-label="Filter squad candidates by branch"
                  className="bg-[#08080A] border border-white/15 rounded px-2 py-2 text-xs"
                >
                  <option value="">All Branches</option>
                  {availableBranches.map((br) => (
                    <option key={br} value={br}>
                      {br}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-48 overflow-y-auto bg-[#08080A] border border-white/15 rounded p-1.5 space-y-1">
                {squadDirectory.map((st) => {
                  const activeList = squadSide === "A" ? squadLineupA : squadLineupB;
                  const inLineup = activeList.includes(st.playerProfileId);
                  return (
                    <button
                      key={st.playerProfileId}
                      type="button"
                      disabled={squadBusy}
                      onClick={() =>
                        handleToggleSquadMember(st.playerProfileId, inLineup ? "REMOVE" : "ADD")
                      }
                      className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded ${
                        inLineup
                          ? "bg-[#10B981]/15 text-[#10B981]"
                          : "hover:bg-white/5 text-[#D6CFC2]"
                      }`}
                    >
                      <span>
                        {inLineup ? "✓ " : "+ "}
                        {st.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#8B8680]">
                        {st.rollNumber ?? st.batch} · {st.batch} {st.branch ?? ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Match Modal */}
      {confirmDeleteMatch && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#F5F2EB]">Delete Scheduled Match</h3>
            <p className="text-xs text-[#D6CFC2]">
              Remove{" "}
              <span className="font-bold text-[#F5F2EB]">
                {confirmDeleteMatch.teamA?.shortCode ?? "Team A"} vs{" "}
                {confirmDeleteMatch.teamB?.shortCode ?? "Team B"}
              </span>{" "}
              ({confirmDeleteMatch.roundLabel})? Any standings impact will be recalculated cleanly.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteMatch(null)}
                className="px-3.5 py-2 rounded bg-white/10 hover:bg-white/15 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndDeleteMatch}
                className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase text-[#F5F2EB]"
              >
                Delete Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Active Tournament Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-2xl w-full p-5 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#D97706]" /> Configure Tournament &amp; Timetables
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-[#8B8680] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[#D6CFC2] block mb-1">Tournament Name</label>
                  <input
                    required
                    value={cfgName}
                    onChange={(e) => setCfgName(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Format</label>
                  <select
                    value={cfgFormat}
                    onChange={(e) => setCfgFormat(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="GROUP_KNOCKOUT">GROUP_KNOCKOUT</option>
                    <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                    <option value="KNOCKOUT">KNOCKOUT</option>
                    <option value="LEAGUE">LEAGUE</option>
                    <option value="BEST_OF_SERIES">BEST_OF_SERIES</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Roster Mode</label>
                  <select
                    value={cfgRosterMode}
                    onChange={(e) => setCfgRosterMode(e.target.value as typeof cfgRosterMode)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="CAPTAIN_SUBMISSION">CAPTAIN_SUBMISSION</option>
                    <option value="AUCTION">AUCTION</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[#D6CFC2] block mb-1">Pre-Registration Split Mode</label>
                  <select
                    value={cfgSplitMode}
                    onChange={(e) => setCfgSplitMode(e.target.value as typeof cfgSplitMode)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="COMBINED">COMBINED (Single Open Pool)</option>
                    <option value="SEPARATE_BOYS_GIRLS">SEPARATE_BOYS_GIRLS (Separate Boys &amp; Girls Tracks)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Starts At</label>
                  <input
                    type="datetime-local"
                    required
                    value={cfgStartsAt}
                    onChange={(e) => setCfgStartsAt(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Ends At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={cfgEndsAt}
                    onChange={(e) => setCfgEndsAt(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-[#D6CFC2] block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={cfgDescription}
                  onChange={(e) => setCfgDescription(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[#D6CFC2] font-semibold uppercase tracking-wider text-[11px]">
                  Sports, Squad Limits &amp; Registration Deadlines
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {cfgSports.map((sp) => (
                    <div
                      key={sp.sportId}
                      className={`p-2.5 rounded border ${
                        sp.enabled
                          ? "bg-[#08080A] border-[#D97706]/40"
                          : "bg-[#08080A]/50 border-white/10 opacity-70"
                      } grid grid-cols-1 sm:grid-cols-12 gap-2 items-center`}
                    >
                      <label className="sm:col-span-4 flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={sp.enabled}
                          onChange={(e) =>
                            setCfgSports((prev) =>
                              prev.map((row) =>
                                row.sportId === sp.sportId ? { ...row, enabled: e.target.checked } : row
                              )
                            )
                          }
                          className="accent-[#B91C1C]"
                        />
                        <span>{sp.name}</span>
                      </label>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-[#8B8680] block">Min</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          disabled={!sp.enabled}
                          value={sp.minSquadSize}
                          onChange={(e) =>
                            setCfgSports((prev) =>
                              prev.map((row) =>
                                row.sportId === sp.sportId
                                  ? { ...row, minSquadSize: Number(e.target.value) }
                                  : row
                              )
                            )
                          }
                          className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-[#8B8680] block">Max</span>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          disabled={!sp.enabled}
                          value={sp.maxSquadSize}
                          onChange={(e) =>
                            setCfgSports((prev) =>
                              prev.map((row) =>
                                row.sportId === sp.sportId
                                  ? { ...row, maxSquadSize: Number(e.target.value) }
                                  : row
                              )
                            )
                          }
                          className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <span className="text-[10px] text-[#8B8680] block">Reg. Deadline</span>
                        <input
                          type="datetime-local"
                          disabled={!sp.enabled}
                          value={sp.registrationDeadline}
                          onChange={(e) =>
                            setCfgSports((prev) =>
                              prev.map((row) =>
                                row.sportId === sp.sportId
                                  ? { ...row, registrationDeadline: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#D6CFC2] cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={cfgNotifyEveryone}
                  onChange={(e) => setCfgNotifyEveryone(e.target.checked)}
                  className="accent-[#D97706]"
                />
                <span>Notify everyone (Yes / No) when saving tournament changes</span>
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3.5 py-2 rounded bg-white/10 hover:bg-white/15 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cfgBusy}
                  className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] font-bold uppercase text-[#F5F2EB] disabled:opacity-50"
                >
                  {cfgBusy ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
