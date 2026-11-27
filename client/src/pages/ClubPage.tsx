import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";

interface SelectedSquadPlayer {
  userId: number;
  playerProfileId: number;
  name: string;
  rollNumber: string | null;
  batch: string;
  branch: string | null;
  isClubMember?: boolean;
}

interface ClubActivity {
  id: number;
  activityType: "PRACTICE" | "INDUCTION" | "MEETING" | "INTER_IIIT" | "EXTERNAL_MATCH" | "OTHER";
  customTypeLabel: string | null;
  targetBatch: string;
  category: string;
  scheduledAt: string;
  venue: string;
  notes: string | null;
  selectedSquadJson?: SelectedSquadPlayer[];
}

interface MemberRow {
  id: number;
  playerProfileId: number;
  role: string;
  batchScope: string | null;
  scopeLabel?: string | null;
  status: string;
  trialNotes: string | null;
  evaluationScore: number | null;
  displayName: string;
  batch: string;
  branch: string | null;
}

interface ClubDetailResponse {
  club: {
    id: number;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    bannerUrl: string;
    practiceSchedule: string | null;
    inductionOpen: boolean;
    sportName: string;
    category?: string;
  };
  activities: ClubActivity[];
  secretary: MemberRow | null;
  coordinators: MemberRow[];
  inductedMembers: MemberRow[];
  myApplication: MemberRow | null;
  inductionQueue: MemberRow[];
  permissions: {
    canManageActivities: boolean;
    canEvaluateTrials: boolean;
    canDecideInductions: boolean;
    canManageLeadership?: boolean;
    canPublishExternalSelection?: boolean;
  };
}

interface ClubDirectoryCard {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  sportName: string;
  category: string;
  bannerUrl: string;
  inductedCount: number;
  upcomingActivitiesCount?: number;
  inductionOpen: boolean;
}

export function ClubDirectoryPage() {
  const { notifyToast } = useApp();
  const [outdoorClubs, setOutdoorClubs] = useState<ClubDirectoryCard[]>([]);
  const [indoorClubs, setIndoorClubs] = useState<ClubDirectoryCard[]>([]);

  useEffect(() => {
    apiFetch<{ outdoorClubs: ClubDirectoryCard[]; indoorClubs: ClubDirectoryCard[] }>("/api/clubs")
      .then((r) => {
        setOutdoorClubs(r.outdoorClubs);
        setIndoorClubs(r.indoorClubs);
      })
      .catch((err) => notifyToast("error", (err as Error).message || "Failed to load clubs."));
  }, [notifyToast]);

  const renderClubGrid = (items: ClubDirectoryCard[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((c) => (
        <Link
          key={c.id}
          to={`/clubs/${c.slug}`}
          className="rdr-panel rounded-lg overflow-hidden hover:border-[#B91C1C]/70 transition group"
        >
          <div className="relative h-44 bg-[#08080A]">
            <img
              src={c.bannerUrl}
              alt={c.name}
              loading="lazy"
              className="w-full h-full object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080A] via-[#08080A]/60 to-transparent" />
            <div className="absolute top-2.5 right-2.5">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  c.inductionOpen
                    ? "bg-[#10B981]/20 border-[#10B981]/60 text-[#34D399]"
                    : "bg-[#08080A]/80 border-white/15 text-[#D6CFC2]"
                }`}
              >
                {c.inductionOpen ? "Inductions Open" : "Inductions Closed"}
              </span>
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <div className="font-editorial text-2xl text-[#F5F2EB] drop-shadow">{c.sportName}</div>
              <div className="text-xs font-semibold text-[#F59E0B] drop-shadow">{c.name}</div>
            </div>
          </div>
          <div className="p-3.5 flex items-center justify-between text-xs text-[#D6CFC2] bg-[#0D0D0F]">
            <span className="font-medium">{c.inductedCount} Inducted Members</span>
            <span className="text-[11px] font-mono text-[#D97706]">
              {c.upcomingActivitiesCount ?? 0} Upcoming
            </span>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b border-white/10 pb-4">
        <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
          Official Athletics
        </div>
        <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">All 9 Sports Clubs</h1>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="font-editorial text-2xl text-[#F5F2EB]">Outdoor &amp; Team Sports</h2>
          <span className="text-xs font-mono text-[#D97706]">{outdoorClubs.length} Clubs</span>
        </div>
        {renderClubGrid(outdoorClubs)}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="font-editorial text-2xl text-[#F5F2EB]">Indoor Games</h2>
          <span className="text-xs font-mono text-[#D97706]">{indoorClubs.length} Clubs</span>
        </div>
        {renderClubGrid(indoorClubs)}
      </section>
    </div>
  );
}

export function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, hasGlobalSportsAuthority, notifyToast, sseVersion } = useApp();
  const [data, setData] = useState<ClubDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [togglingInduction, setTogglingInduction] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<MemberRow | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  // Activity Editor State
  const [showActForm, setShowActForm] = useState(false);
  const [actType, setActType] = useState<
    "PRACTICE" | "INDUCTION" | "MEETING" | "INTER_IIIT" | "EXTERNAL_MATCH" | "OTHER"
  >("PRACTICE");
  const [customLabel, setCustomLabel] = useState("");
  const [targetBatch, setTargetBatch] = useState("ALL");
  const [category, setCategory] = useState("OPEN");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");
  const [squadQuery, setSquadQuery] = useState("");
  const [squadCandidates, setSquadCandidates] = useState<SelectedSquadPlayer[]>([]);
  const [searchingSquad, setSearchingSquad] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<SelectedSquadPlayer[]>([]);
  const [savingActivity, setSavingActivity] = useState(false);

  // Trial evaluation state
  const [trialNoteMap, setTrialNoteMap] = useState<Record<number, string>>({});
  const [trialScoreMap, setTrialScoreMap] = useState<Record<number, number>>({});

  // Coordinator management state
  const [showCoordForm, setShowCoordForm] = useState(false);
  const [coordQuery, setCoordQuery] = useState("");
  const [coordCandidates, setCoordCandidates] = useState<SelectedSquadPlayer[]>([]);
  const [coordUserId, setCoordUserId] = useState<number>(0);
  const [coordBatch, setCoordBatch] = useState<"1ST" | "2ND" | "3RD" | "4TH" | "MTECH" | "ALL">("1ST");
  const [coordLabel, setCoordLabel] = useState("");
  const [savingCoord, setSavingCoord] = useState(false);
  const [removingCoordId, setRemovingCoordId] = useState<number | null>(null);

  const fetchStudentDirectory = useCallback(async (q: string) => {
    const res = await apiFetch<{ students: SelectedSquadPlayer[] }>(
      `/api/roles/directory?q=${encodeURIComponent(q.trim())}`
    );
    return res.students;
  }, []);

  const loadClub = useCallback(async () => {
    if (!slug) return;
    setLoadError(null);
    try {
      const res = await apiFetch<ClubDetailResponse>(`/api/clubs/${slug}`);
      setData(res);
    } catch (err) {
      const msg = (err as Error).message || "Failed to load club hub.";
      setLoadError(msg);
      notifyToast("error", msg);
    } finally {
      setLoading(false);
    }
  }, [slug, notifyToast]);

  useEffect(() => {
    if (!confirmRemoveMember) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmRemoveMember(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmRemoveMember]);

  useEffect(() => {
    setApplyError(null);
    loadClub();
  }, [loadClub, sseVersion, user?.id]);

  useEffect(() => {
    if (!showCoordForm || !user) return;
    let active = true;
    const timer = setTimeout(() => {
      fetchStudentDirectory(coordQuery)
        .then((students) => {
          if (!active) return;
          setCoordCandidates(students);
          setCoordUserId((prev) =>
            prev && students.some((s) => s.userId === prev) ? prev : students[0]?.userId ?? 0
          );
        })
        .catch((err) => notifyToast("error", (err as Error).message || "Failed to search students."));
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showCoordForm, coordQuery, user, fetchStudentDirectory]);

  const canSelectExternalSquad = Boolean(
    data?.permissions.canPublishExternalSelection || data?.permissions.canDecideInductions
  );
  const showSquadPickerInForm =
    showActForm &&
    canSelectExternalSquad &&
    (actType === "INTER_IIIT" || actType === "EXTERNAL_MATCH" || actType === "OTHER");

  useEffect(() => {
    if (!showSquadPickerInForm || !user) return;
    let active = true;
    setSearchingSquad(true);
    const timer = setTimeout(() => {
      fetchStudentDirectory(squadQuery)
        .then((students) => {
          if (active) setSquadCandidates(students);
        })
        .catch((err) => notifyToast("error", (err as Error).message || "Failed to search students."))
        .finally(() => {
          if (active) setSearchingSquad(false);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showSquadPickerInForm, squadQuery, user, fetchStudentDirectory]);

  const handleAddCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !coordUserId || savingCoord) return;
    setSavingCoord(true);
    try {
      await apiFetch(`/api/clubs/${slug}/coordinators`, {
        method: "POST",
        body: JSON.stringify({
          userId: coordUserId,
          batchScope: coordBatch,
          scopeLabel: coordLabel.trim() || null,
        }),
      });
      setCoordLabel("");
      setShowCoordForm(false);
      await loadClub();
      notifyToast("success", "Batch coordinator added.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSavingCoord(false);
    }
  };

  const handleRemoveCoordinator = async (membershipId: number) => {
    if (!slug || removingCoordId !== null) return;
    setRemovingCoordId(membershipId);
    try {
      await apiFetch(`/api/clubs/${slug}/coordinators/${membershipId}`, { method: "DELETE" });
      await loadClub();
      notifyToast("info", "Coordinator removed.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setRemovingCoordId(null);
    }
  };

  const toggleSquadSelection = (st: SelectedSquadPlayer) => {
    setSelectedSquad((prev) =>
      prev.some((p) => p.playerProfileId === st.playerProfileId)
        ? prev.filter((p) => p.playerProfileId !== st.playerProfileId)
        : [...prev, st]
    );
  };

  const handleRemoveMember = async () => {
    if (!slug || !confirmRemoveMember || removingMemberId !== null) return;
    setRemovingMemberId(confirmRemoveMember.id);
    try {
      await apiFetch(`/api/clubs/${slug}/members/${confirmRemoveMember.id}`, {
        method: "DELETE",
      });
      const removedName = confirmRemoveMember.displayName;
      setConfirmRemoveMember(null);
      await loadClub();
      notifyToast("info", `${removedName} removed from club roster.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || savingActivity) return;
    setSavingActivity(true);
    try {
      const iso = new Date(scheduledLocal).toISOString();
      const res = await apiFetch<{ notifiedCount: number }>(`/api/clubs/${slug}/activities`, {
        method: "POST",
        body: JSON.stringify({
          activityType: actType,
          customTypeLabel: actType === "OTHER" ? customLabel : null,
          targetBatch,
          category,
          scheduledAt: iso,
          venue,
          notes,
          selectedPlayerProfileIds: showSquadPickerInForm
            ? selectedSquad.map((s) => s.playerProfileId)
            : [],
        }),
      });
      setShowActForm(false);
      setCustomLabel("");
      setVenue("");
      setNotes("");
      setSelectedSquad([]);
      setSquadQuery("");
      await loadClub();
      notifyToast("success", `Published! Notified ${res.notifiedCount} players & club members.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    if (!slug) return;
    try {
      await apiFetch(`/api/clubs/${slug}/activities/${activityId}`, { method: "DELETE" });
      await loadClub();
      notifyToast("info", "Activity removed.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleApplyInduction = async () => {
    if (!slug || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      await apiFetch(`/api/clubs/${slug}/induction-apply`, { method: "POST" });
      await loadClub();
      notifyToast("success", "Induction application submitted! Attend your batch trial session.");
    } catch (err) {
      const msg = (err as Error).message || "Failed to submit induction application.";
      setApplyError(msg);
      notifyToast("error", msg);
    } finally {
      setApplying(false);
    }
  };

  const handleToggleInduction = async () => {
    if (!slug || !data || togglingInduction) return;
    setTogglingInduction(true);
    try {
      await apiFetch(`/api/clubs/${slug}/toggle-induction`, {
        method: "POST",
        body: JSON.stringify({ inductionOpen: !data.club.inductionOpen }),
      });
      await loadClub();
      notifyToast("success", `Inductions ${!data.club.inductionOpen ? "opened" : "closed"}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setTogglingInduction(false);
    }
  };

  const handleLogTrial = async (membershipId: number) => {
    if (!slug) return;
    try {
      await apiFetch(`/api/clubs/${slug}/inductions/${membershipId}/trial`, {
        method: "PATCH",
        body: JSON.stringify({
          trialNotes: trialNoteMap[membershipId] || "Attended batch induction trial.",
          evaluationScore: trialScoreMap[membershipId] || 7,
        }),
      });
      await loadClub();
      notifyToast("success", "Trial attendance & evaluation saved (TRIAL_ATTENDED).");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleDecision = async (membershipId: number, decision: "INDUCTED" | "REJECTED") => {
    if (!slug || decidingId !== null) return;
    setDecidingId(membershipId);
    try {
      await apiFetch(`/api/clubs/${slug}/inductions/${membershipId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
        }),
      });
      await loadClub();
      notifyToast("success", `Applicant marked ${decision}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto p-8 text-sm text-[#8B8680]">Loading club hub...</div>;
  }

  if (loadError || !data) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="rdr-panel rounded-lg p-6 border border-[#DC2626]/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#FCA5A5]">{loadError || "Sports club not found."}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                loadClub();
              }}
              className="px-3.5 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase text-[#F5F2EB]"
            >
              Retry
            </button>
            <Link to="/clubs" className="px-3.5 py-1.5 rounded bg-white/10 text-xs font-semibold">
              All Clubs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { club, activities, secretary, coordinators, inductedMembers, myApplication, inductionQueue, permissions } =
    data;

  const isPendingOrInducted = Boolean(
    myApplication && ["APPLIED", "TRIAL_ATTENDED", "INDUCTED"].includes(myApplication.status)
  );
  const canApplyInduction = Boolean(user && club.inductionOpen && !isPendingOrInducted);

  const membershipBadge = (() => {
    if (!myApplication) return null;
    switch (myApplication.status) {
      case "APPLIED":
        return {
          label: "Applied — Pending Trial",
          cls: "border-[#D97706]/60 text-[#F59E0B]",
        };
      case "TRIAL_ATTENDED":
        return {
          label: "Trial Attended — Pending Secretary Approval",
          cls: "border-[#38BDF8]/60 text-[#38BDF8]",
        };
      case "INDUCTED":
        return {
          label: "Inducted Club Member",
          cls: "border-[#10B981]/60 text-[#10B981]",
        };
      case "REJECTED":
        return {
          label: "Previous Application Not Selected",
          cls: "border-white/20 text-[#D6CFC2]",
        };
      default:
        return {
          label: myApplication.status,
          cls: "border-white/20 text-[#D6CFC2]",
        };
    }
  })();

  const categoryLabel =
    club.category === "OUTDOOR_TEAM"
      ? "OUTDOOR & TEAM"
      : club.category === "INDOOR"
      ? "INDOOR"
      : club.sportName;

  const renderInductionControls = () => (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {membershipBadge && (
          <span
            className={`px-3 py-1.5 rounded bg-[#141418] border text-xs font-semibold ${membershipBadge.cls}`}
          >
            {membershipBadge.label}
          </span>
        )}
        {!club.inductionOpen && myApplication?.status !== "INDUCTED" && (
          <span className="px-3 py-1.5 rounded bg-[#141418] border border-white/15 text-xs font-semibold text-[#D6CFC2]">
            Inductions Currently Closed
          </span>
        )}
        {canApplyInduction && (
          <button
            type="button"
            disabled={applying}
            onClick={handleApplyInduction}
            className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] disabled:opacity-60 text-xs font-bold uppercase tracking-wider text-[#F5F2EB] shadow"
          >
            {applying ? "Applying..." : "Apply for Club Induction"}
          </button>
        )}
      </div>
      {applyError && (
        <div
          role="alert"
          className="px-3 py-1.5 rounded bg-[#DC2626]/20 border border-[#DC2626]/60 text-xs text-[#FCA5A5]"
        >
          {applyError}
        </div>
      )}
    </div>
  );

  const batchGroups = ["1ST", "2ND", "3RD", "4TH", "MTECH"];

  return (
    <div className="pb-14 space-y-8">
      {/* Club Banner Header */}
      <section className="relative h-64 sm:h-72 overflow-hidden border-b border-[#B91C1C]/40">
        <img
          src={club.bannerUrl}
          alt={club.name}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080A] via-[#08080A]/70 to-black/30" />
        <div className="relative z-10 max-w-6xl mx-auto h-full px-4 sm:px-6 flex flex-col justify-end pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/50 border border-[#D97706]/40 text-[10px] uppercase tracking-[0.18em] text-[#D97706] font-bold">
                  {categoryLabel}
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-[0.15em] ${
                    club.inductionOpen
                      ? "bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]"
                      : "bg-white/10 border-white/15 text-[#D6CFC2]"
                  }`}
                >
                  {club.inductionOpen ? "Inductions Open" : "Inductions Closed"}
                </span>
              </div>
              <h1 className="font-editorial text-4xl sm:text-6xl text-[#F5F2EB] uppercase leading-none">
                {club.name}
              </h1>
              {club.description && (
                <p className="text-xs sm:text-sm text-[#D6CFC2] max-w-2xl">{club.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {permissions.canDecideInductions && (
                <button
                  type="button"
                  onClick={handleToggleInduction}
                  className="px-3 py-2 rounded bg-[#141418] border border-[#D97706]/60 text-xs font-semibold uppercase tracking-wider"
                >
                  {club.inductionOpen ? "Close Inductions" : "Open Inductions"}
                </button>
              )}
              {renderInductionControls()}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* SECTION 1 (TOP): UPCOMING ACTIVITIES LIST + ROLE-RESTRICTED EDITOR */}
        <section className="rdr-panel rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-editorial text-3xl text-[#F5F2EB]">Upcoming Club Activities</h2>
              <p className="text-xs text-[#8B8680]">
                Regular Schedule: {club.practiceSchedule ?? "Announced per session"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(permissions.canPublishExternalSelection || permissions.canDecideInductions) && (
                <button
                  type="button"
                  onClick={() => {
                    setActType("INTER_IIIT");
                    setShowActForm(true);
                  }}
                  className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 hover:border-[#F59E0B] text-[#F59E0B] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5" /> Publish Inter-IIIT / External Squad
                </button>
              )}
              {permissions.canManageActivities ? (
                <button
                  type="button"
                  onClick={() => setShowActForm((v) => !v)}
                  className="px-3.5 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Post Club Activity
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded bg-[#0D0D0F] border border-white/10 text-[11px] text-[#8B8680]">
                  {user
                    ? "Read-only: Only this club's Secretary, batch Coordinators, or Sports Secretary can post activities."
                    : "Sign in with @iiitt.ac.in to apply for inductions or manage activities."}
                </span>
              )}
            </div>
          </div>

          {showActForm && permissions.canManageActivities && (
            <form onSubmit={handleAddActivity} className="bg-[#08080A] border border-[#B91C1C]/40 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Type</label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value as typeof actType)}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  >
                    <option value="PRACTICE">Practice</option>
                    <option value="INDUCTION">Induction</option>
                    <option value="MEETING">Meeting</option>
                    {(permissions.canPublishExternalSelection || permissions.canDecideInductions) && (
                      <>
                        <option value="INTER_IIIT">Inter-IIIT Selection</option>
                        <option value="EXTERNAL_MATCH">External Match Selection</option>
                      </>
                    )}
                    <option value="OTHER">Other (Custom)</option>
                  </select>
                </div>
                {actType === "OTHER" && (
                  <div>
                    <label className="text-[11px] text-[#D97706] block mb-1">Custom Type Label</label>
                    <input
                      type="text"
                      required
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="e.g., Video Analysis"
                      className="w-full bg-[#141418] border border-[#D97706]/50 rounded px-2.5 py-2 text-xs"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Target Batch</label>
                  <select
                    value={targetBatch}
                    onChange={(e) => setTargetBatch(e.target.value)}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  >
                    <option value="ALL">All Batches</option>
                    <option value="1ST">1st Year</option>
                    <option value="2ND">2nd Year</option>
                    <option value="3RD">3rd Year</option>
                    <option value="4TH">4th Year</option>
                    <option value="MTECH">MTech</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  >
                    <option value="OPEN">Open</option>
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Venue</label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Main Ground / Indoor Court 1"
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Kit requirements or drills"
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-2 text-xs"
                  />
                </div>
              </div>
              {showSquadPickerInForm && (
                <div className="p-3 rounded bg-[#111114] border border-[#D97706]/35 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#D97706]">
                      Select Squad Players (Inducted Members &amp; Non-Club Students)
                    </span>
                    <span className="font-mono text-[11px] text-[#8B8680]">
                      {selectedSquad.length} selected
                    </span>
                  </div>

                  {selectedSquad.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded bg-[#08080A] border border-white/10 max-h-28 overflow-y-auto">
                      {selectedSquad.map((p) => {
                        const isMember = inductedMembers.some(
                          (m) => m.playerProfileId === p.playerProfileId
                        );
                        return (
                          <span
                            key={p.playerProfileId}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#141418] border border-white/15 text-[11px] text-[#F5F2EB]"
                          >
                            <span>
                              {p.name} ({p.rollNumber ?? p.batch})
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                isMember
                                  ? "bg-[#10B981]/20 text-[#10B981]"
                                  : "bg-[#D97706]/20 text-[#F59E0B]"
                              }`}
                            >
                              {isMember ? "Club Member" : "Non-Club"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleSquadSelection(p)}
                              aria-label={`Remove ${p.name}`}
                              className="text-[#8B8680] hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={squadQuery}
                      onChange={(e) => setSquadQuery(e.target.value)}
                      placeholder="Search any IIITT student by name, roll number, batch, or branch..."
                      className="w-full bg-[#08080A] border border-white/15 rounded pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto bg-[#08080A] border border-white/15 rounded p-1.5 space-y-1">
                    {searchingSquad ? (
                      <div className="text-xs text-[#8B8680] p-2 text-center">Searching students...</div>
                    ) : squadCandidates.length === 0 ? (
                      <div className="text-xs text-[#8B8680] p-2 text-center">No matching students found.</div>
                    ) : (
                      squadCandidates.map((st) => {
                        const checked = selectedSquad.some(
                          (p) => p.playerProfileId === st.playerProfileId
                        );
                        const isMember = inductedMembers.some(
                          (m) => m.playerProfileId === st.playerProfileId
                        );
                        return (
                          <button
                            key={st.playerProfileId}
                            type="button"
                            onClick={() => toggleSquadSelection(st)}
                            className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded transition ${
                              checked
                                ? "bg-[#10B981]/15 border border-[#10B981]/50 text-[#F5F2EB]"
                                : "hover:bg-white/5 border border-transparent text-[#D6CFC2]"
                            }`}
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <span>
                                {checked ? "✓ " : "+ "}
                                {st.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  isMember
                                    ? "bg-[#10B981]/20 text-[#10B981]"
                                    : "bg-[#D97706]/20 text-[#F59E0B]"
                                }`}
                              >
                                {isMember ? "Club Member" : "Non-Club"}
                              </span>
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
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowActForm(false)} className="px-3 py-1.5 rounded bg-white/10 text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingActivity}
                  className="px-4 py-1.5 rounded bg-[#B91C1C] disabled:opacity-50 text-xs font-bold uppercase"
                >
                  {savingActivity ? "Publishing..." : "Save & Notify Players"}
                </button>
              </div>
            </form>
          )}

          {activities.length === 0 ? (
            <p className="text-xs text-[#8B8680] py-4">No upcoming club activities scheduled yet.</p>
          ) : (
            <div className="space-y-2.5">
              {activities.map((act) => {
                const label =
                  act.activityType === "OTHER" && act.customTypeLabel
                    ? act.customTypeLabel
                    : act.activityType === "INTER_IIIT"
                    ? "Inter-IIIT Selection"
                    : act.activityType === "EXTERNAL_MATCH"
                    ? "External Match Selection"
                    : act.activityType;
                return (
                  <div
                    key={act.id}
                    className="p-3.5 rounded bg-[#08080A] border border-white/10 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#B91C1C]/25 border border-[#B91C1C]/60 text-[10px] font-bold uppercase tracking-wider text-[#F5F2EB]">
                          {label}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#D97706]/20 text-[#F59E0B] text-[10px] font-bold uppercase">
                          {act.targetBatch === "ALL" ? "All Batches" : `${act.targetBatch} Year`}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[#D6CFC2] text-[10px] font-semibold uppercase">
                          {act.category}
                        </span>
                      </div>
                      {act.notes && <p className="text-xs text-[#D6CFC2]">{act.notes}</p>}
                      {act.selectedSquadJson && act.selectedSquadJson.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-[#D97706]">
                            Selected Squad ({act.selectedSquadJson.length} Players)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {act.selectedSquadJson.map((p) => (
                              <Link
                                key={p.playerProfileId}
                                to={`/players/${p.playerProfileId}`}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#141418] border border-white/10 hover:border-[#D97706]/50 text-[11px] text-[#F5F2EB]"
                              >
                                <span>
                                  {p.name} ({p.batch})
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                    p.isClubMember
                                      ? "bg-[#10B981]/20 text-[#10B981]"
                                      : "bg-[#D97706]/20 text-[#F59E0B]"
                                  }`}
                                >
                                  {p.isClubMember ? "Club Member" : "Non-Club"}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#8B8680] shrink-0 tabular-nums">
                      <span className="flex items-center gap-1 text-[#F5F2EB]">
                        <Clock className="w-3.5 h-3.5 text-[#D97706]" /> {formatIST(act.scheduledAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#B91C1C]" /> {act.venue}
                      </span>
                      {permissions.canManageActivities && (
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          title="Delete activity"
                          className="p-1 text-[#DC2626] hover:bg-white/5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2 (BELOW): LEADERSHIP, INDUCTED ROSTER & INDUCTION PIPELINE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leadership Hierarchy */}
          <section className="rdr-panel rounded-lg p-5 space-y-4">
            <h2 className="font-editorial text-2xl text-[#F5F2EB] border-b border-white/10 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D97706]" /> Club Leadership
            </h2>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-[#D97706] font-bold">
                Club Secretary
              </div>
              {secretary ? (
                <Link
                  to={`/players/${secretary.playerProfileId}`}
                  className="block p-3 rounded bg-[#1A1212] border border-[#B91C1C]/50 hover:border-[#D97706]"
                >
                  <div className="text-sm font-bold text-[#F5F2EB]">{secretary.displayName}</div>
                  <div className="text-xs text-[#D6CFC2]">
                    {secretary.batch} Year • {secretary.branch ?? "IIITT"}
                  </div>
                </Link>
              ) : (
                <p className="text-xs text-[#8B8680]">Position currently vacant.</p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-widest text-[#D97706] font-bold">
                  Year-Wise Coordinators
                </div>
                {(permissions.canManageLeadership || permissions.canDecideInductions) && (
                  <button
                    type="button"
                    onClick={() => setShowCoordForm((v) => !v)}
                    className="px-2 py-0.5 rounded bg-[#B91C1C]/25 border border-[#B91C1C]/60 hover:bg-[#B91C1C]/40 text-[10px] font-bold uppercase text-[#F5F2EB] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>

              {showCoordForm && (permissions.canManageLeadership || permissions.canDecideInductions) && (
                <form
                  onSubmit={handleAddCoordinator}
                  className="p-3 rounded bg-[#08080A] border border-[#D97706]/40 space-y-2 text-xs"
                >
                  <input
                    type="text"
                    value={coordQuery}
                    onChange={(e) => setCoordQuery(e.target.value)}
                    placeholder="Search student name or roll..."
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 text-xs"
                  />
                  <select
                    value={coordUserId}
                    onChange={(e) => setCoordUserId(Number(e.target.value))}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1.5 text-xs"
                  >
                    {coordCandidates.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name} ({s.rollNumber ?? s.batch} · {s.batch} {s.branch ?? ""})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={coordBatch}
                      onChange={(e) => setCoordBatch(e.target.value as typeof coordBatch)}
                      className="bg-[#141418] border border-white/15 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="1ST">1st Year</option>
                      <option value="2ND">2nd Year</option>
                      <option value="3RD">3rd Year</option>
                      <option value="4TH">4th Year</option>
                      <option value="MTECH">MTech</option>
                      <option value="ALL">All Batches</option>
                    </select>
                    <input
                      type="text"
                      maxLength={40}
                      value={coordLabel}
                      onChange={(e) => setCoordLabel(e.target.value)}
                      placeholder="Label (e.g. Boys / Girls)"
                      className="bg-[#141418] border border-white/15 rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCoordForm(false)}
                      className="px-2.5 py-1 rounded bg-white/10 text-[11px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCoord || !coordUserId}
                      className="px-2.5 py-1 rounded bg-[#D97706] text-[#08080A] text-[11px] font-bold uppercase disabled:opacity-50"
                    >
                      {savingCoord ? "Adding..." : "Appoint"}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {[...batchGroups, ...(coordinators.some((c) => c.batchScope === "ALL") ? ["ALL"] : [])].map((b) => {
                  const coords = coordinators.filter((c) => c.batchScope === b);
                  return (
                    <div key={b} className="p-2.5 rounded bg-[#08080A] border border-white/10 space-y-1">
                      <div className="text-[10px] font-mono text-[#8B8680]">
                        {b === "ALL" ? "ALL BATCHES" : `${b} YEAR`}
                      </div>
                      {coords.length === 0 ? (
                        <div className="text-xs text-[#8B8680]">Open slot</div>
                      ) : (
                        <div className="space-y-1">
                          {coords.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <Link
                                  to={`/players/${c.playerProfileId}`}
                                  className="text-xs font-semibold text-[#F5F2EB] hover:text-[#D97706] truncate"
                                >
                                  {c.displayName} ({c.branch ?? "IIITT"})
                                </Link>
                                {c.scopeLabel && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#D97706]/15 border border-[#D97706]/40 text-[10px] font-semibold text-[#F59E0B]">
                                    {c.scopeLabel}
                                  </span>
                                )}
                              </div>
                              {(permissions.canManageLeadership || permissions.canDecideInductions) && (
                                <button
                                  type="button"
                                  disabled={removingCoordId === c.id}
                                  onClick={() => handleRemoveCoordinator(c.id)}
                                  title={`Remove ${c.displayName} as coordinator`}
                                  className="p-1 text-[#8B8680] hover:text-[#DC2626] disabled:opacity-50 shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Inducted Roster + Induction Pipeline */}
          <section className="lg:col-span-2 space-y-6">
            <div className="rdr-panel rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#10B981]" /> Inducted Club Members ({inductedMembers.length})
                  </h2>
                  <span className="text-[11px] text-[#8B8680]">Eligible for Prothymos CLUB class</span>
                </div>
                {renderInductionControls()}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inductedMembers.map((m) => {
                  const canRemoveThisMember =
                    (permissions.canManageLeadership || permissions.canDecideInductions) &&
                    (m.role !== "SECRETARY" || hasGlobalSportsAuthority);
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/50 flex items-center justify-between gap-2"
                    >
                      <Link to={`/players/${m.playerProfileId}`} className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#F5F2EB] truncate">
                          {m.displayName}
                        </div>
                        <div className="text-[11px] text-[#8B8680]">
                          {m.batch} Year • {m.branch ?? "IIITT"}
                        </div>
                      </Link>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold uppercase">
                          {m.role}
                        </span>
                        {canRemoveThisMember && (
                          <button
                            type="button"
                            disabled={removingMemberId === m.id}
                            onClick={() => setConfirmRemoveMember(m)}
                            title={`Remove ${m.displayName} from ${club.name}`}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-[#DC2626]/25 border border-white/10 hover:border-[#DC2626]/60 text-[10px] font-semibold text-[#D6CFC2] hover:text-[#FCA5A5] flex items-center gap-1 disabled:opacity-50"
                          >
                            <UserMinus className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Induction Trials & Approval Queue */}
            {(permissions.canEvaluateTrials || permissions.canDecideInductions) && (
              <div className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-4">
                <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#D97706]" /> Batch-Wise Induction Pipeline
                </h2>
                {inductionQueue.length === 0 ? (
                  <p className="text-xs text-[#8B8680]">No pending induction applicants.</p>
                ) : (
                  <div className="space-y-3">
                    {inductionQueue.map((app) => (
                      <div key={app.id} className="p-3.5 rounded bg-[#08080A] border border-white/15 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <Link to={`/players/${app.playerProfileId}`} className="text-sm font-bold text-[#F5F2EB] hover:underline">
                              {app.displayName}
                            </Link>
                            <div className="text-xs text-[#8B8680]">
                              {app.batch} Year • {app.branch ?? "IIITT"}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-[#D97706]/20 text-[#F59E0B] text-[10px] font-bold uppercase">
                            {app.status}
                          </span>
                        </div>

                        {app.trialNotes && (
                          <div className="text-xs text-[#D6CFC2] bg-[#141418] p-2 rounded">
                            Trial Note: {app.trialNotes}{" "}
                            {app.evaluationScore ? `(Score: ${app.evaluationScore}/10)` : ""}
                          </div>
                        )}

                        {app.status === "APPLIED" && permissions.canEvaluateTrials && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="Trial evaluation notes..."
                              value={trialNoteMap[app.id] ?? ""}
                              onChange={(e) =>
                                setTrialNoteMap((p) => ({ ...p, [app.id]: e.target.value }))
                              }
                              className="flex-1 bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 text-xs"
                            />
                            <input
                              type="number"
                              min={1}
                              max={10}
                              placeholder="Score 1-10"
                              value={trialScoreMap[app.id] ?? 8}
                              onChange={(e) =>
                                setTrialScoreMap((p) => ({ ...p, [app.id]: Number(e.target.value) }))
                              }
                              className="w-24 bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleLogTrial(app.id)}
                              className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] text-xs font-bold uppercase"
                            >
                              Mark Trial Attended
                            </button>
                          </div>
                        )}

                        {permissions.canDecideInductions && app.status !== "REJECTED" && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                            {app.status === "APPLIED" ? (
                              <span className="text-[11px] text-[#8B8680]">
                                Trial attendance (TRIAL_ATTENDED) required before induction.
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#10B981] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Trial verified — ready for final decision
                              </span>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={decidingId === app.id}
                                onClick={() => handleDecision(app.id, "REJECTED")}
                                className="px-3 py-1 rounded bg-white/10 hover:bg-[#DC2626]/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                              >
                                {decidingId === app.id ? "Saving..." : "Reject"}
                              </button>
                              {app.status === "TRIAL_ATTENDED" && (
                                <button
                                  type="button"
                                  disabled={decidingId === app.id}
                                  onClick={() => handleDecision(app.id, "INDUCTED")}
                                  className="px-3 py-1 rounded bg-[#10B981] disabled:opacity-50 disabled:cursor-not-allowed text-[#08080A] text-xs font-bold uppercase flex items-center gap-1"
                                >
                                  <Award className="w-3.5 h-3.5" /> {decidingId === app.id ? "Saving..." : "Induct Member"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirm Remove Club Member Modal */}
      {confirmRemoveMember && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-editorial text-2xl text-[#F5F2EB]">Confirm Remove Member</h3>
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                className="text-[#8B8680] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#D6CFC2] leading-relaxed">
              Remove <span className="font-bold text-[#F5F2EB]">{confirmRemoveMember.displayName}</span>{" "}
              ({confirmRemoveMember.role}) from{" "}
              <span className="font-semibold text-[#D97706]">{club.name}</span>? Their club membership and
              club-scoped leadership/member permissions for this club will be revoked.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={removingMemberId !== null}
                onClick={() => setConfirmRemoveMember(null)}
                className="px-3 py-1.5 rounded bg-white/10 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingMemberId !== null}
                onClick={handleRemoveMember}
                className="px-4 py-1.5 rounded bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-xs font-bold uppercase text-white"
              >
                {removingMemberId !== null ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
