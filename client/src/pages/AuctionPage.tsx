import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Bookmark,
  CheckCircle2,
  Coins,
  Edit3,
  Layers,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";
import { FinalRosterView } from "../components/FinalRosterView.tsx";
import {
  useAuctionSync,
  type HydratedAuctionPlayer,
  type HydratedFranchise,
} from "../hooks/useAuctionSync.ts";

const SPORT_POSITIONS: Record<string, string[]> = {
  cricket: ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper", "Captain"],
  football: ["Striker", "Winger", "Midfielder", "Defender", "Goalkeeper"],
  volleyball: ["Setter", "Outside Hitter", "Middle Blocker", "Libero", "Opposite"],
  badminton: ["Singles", "Doubles", "Mixed Doubles"],
  table_tennis: ["Singles", "Doubles", "Mixed Doubles"],
  kabaddi: ["Raider", "Left Corner", "Right Corner", "All-Rounder"],
  kho_kho: ["Chaser", "Runner", "All-Rounder"],
  carrom: ["Singles", "Doubles"],
  chess: ["Board 1", "Board 2", "Board 3", "Board 4", "Reserve"],
};

type AdminTab = "CONFIG" | "FRANCHISES" | "ROUNDS" | "POOL" | "OPERATORS";

export function AuctionPage() {
  const { user, bootstrap, notifyToast, refreshAll } = useApp();
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const { snapshot, loading, refresh } = useAuctionSync(selectedSportId);

  // Student Registration Form State
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [achievements, setAchievements] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);

  // Captain Watchlist State
  const [watchNoteMap, setWatchNoteMap] = useState<Record<number, string>>({});
  const [watchBidMap, setWatchBidMap] = useState<Record<number, string>>({});

  // Admin Tabs & Config State
  const [adminTab, setAdminTab] = useState<AdminTab>("CONFIG");
  const [showFinalRoster, setShowFinalRoster] = useState(false);
  const [finalRosterToggled, setFinalRosterToggled] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | "">("");
  const [operatorBusy, setOperatorBusy] = useState(false);
  const [publishingRosters, setPublishingRosters] = useState(false);
  const [publishedTournamentName, setPublishedTournamentName] = useState<string | null>(null);

  // Auction Team Registration Form & Review State
  const [regTeamName, setRegTeamName] = useState("");
  const [regShortCode, setRegShortCode] = useState("");
  const [regTeamColor, setRegTeamColor] = useState("#D97706");
  const [regTeamNotes, setRegTeamNotes] = useState("");
  const [submittingTeamReg, setSubmittingTeamReg] = useState(false);
  const [reviewPurseMap, setReviewPurseMap] = useState<Record<number, number>>({});
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<number, string>>({});
  const [reviewingTeamId, setReviewingTeamId] = useState<number | null>(null);
  const [cfgName, setCfgName] = useState("");
  const [cfgStatus, setCfgStatus] = useState<
    "DRAFT" | "REGISTRATION_OPEN" | "FROZEN" | "LIVE" | "COMPLETED" | "PUBLISHED"
  >("REGISTRATION_OPEN");
  const [cfgSplitMode, setCfgSplitMode] = useState<"COMBINED" | "SEPARATE_BOYS_GIRLS">("COMBINED");
  const [cfgDeadline, setCfgDeadline] = useState("");
  const [cfgClubBase, setCfgClubBase] = useState(500);
  const [cfgNonClubBase, setCfgNonClubBase] = useState(200);
  const [cfgSportClubBase, setCfgSportClubBase] = useState(500);
  const [cfgSportNonClubBase, setCfgSportNonClubBase] = useState(200);
  const [cfgDefaultInc, setCfgDefaultInc] = useState(100);
  const [cfgJumpInc, setCfgJumpInc] = useState(500);
  const [cfgRtmEnabled, setCfgRtmEnabled] = useState(true);

  // Franchise Form / Edit State
  const [editFranchise, setEditFranchise] = useState<HydratedFranchise | null>(null);
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fColor, setFColor] = useState("#D97706");
  const [fPurse, setFPurse] = useState(20000);
  const [fMinSquad, setFMinSquad] = useState(11);
  const [fMaxSquad, setFMaxSquad] = useState(15);
  const [fMinClub, setFMinClub] = useState(3);
  const [fMinNonClub, setFMinNonClub] = useState(4);
  const [fCaptainId, setFCaptainId] = useState<number | "">("");
  const [capQuery, setCapQuery] = useState("");
  const [capOptions, setCapOptions] = useState<
    Array<{ userId: number; name: string; rollNumber: string | null; batch: string; branch: string | null }>
  >([]);

  // Round Form State
  const [rName, setRName] = useState("");
  const [rOrder, setROrder] = useState(4);
  const [rType, setRType] = useState<"MAIN" | "ACCELERATED" | "UNSOLD" | "RTM">("MAIN");

  // Pool Filter, Sort & Inline Edit State
  const [poolQuery, setPoolQuery] = useState("");
  const [poolSort, setPoolSort] = useState<"NAME" | "BATCH" | "BRANCH" | "BASE" | "STATUS">("NAME");
  const [editingPlayer, setEditingPlayer] = useState<HydratedAuctionPlayer | null>(null);
  const [epClass, setEpClass] = useState<"CLUB" | "NON_CLUB">("CLUB");
  const [epBase, setEpBase] = useState(500);
  const [epTier, setEpTier] = useState<"MARQUEE" | "TIER_1" | "STANDARD">("STANDARD");
  const [epStatus, setEpStatus] = useState<HydratedAuctionPlayer["status"]>("ELIGIBLE");
  const [epRoundId, setEpRoundId] = useState<number | "">("");
  const [epPositionsText, setEpPositionsText] = useState("");

  const auction = snapshot?.auction ?? null;
  const sportsList = snapshot?.sports ?? [];
  const activeSport = useMemo(() => {
    if (selectedSportId) return sportsList.find((s) => s.id === selectedSportId) ?? sportsList[0] ?? null;
    if (auction?.activeSportId) {
      return sportsList.find((s) => s.id === auction.activeSportId) ?? sportsList[0] ?? null;
    }
    return sportsList[0] ?? null;
  }, [selectedSportId, sportsList, auction?.activeSportId]);

  useEffect(() => {
    if (!selectedSportId && activeSport) {
      setSelectedSportId(activeSport.id);
    }
  }, [selectedSportId, activeSport]);

  useEffect(() => {
    setSelectedPositions([]);
  }, [activeSport?.id]);

  useEffect(() => {
    if (!auction) return;
    if (!finalRosterToggled && (auction.status === "COMPLETED" || auction.status === "PUBLISHED")) {
      setShowFinalRoster(true);
    }
    setCfgName(auction.name);
    setCfgStatus(auction.status);
    setCfgSplitMode(auction.splitMode ?? "COMBINED");
    setCfgDeadline(
      auction.registrationDeadline
        ? new Date(
            new Date(auction.registrationDeadline).getTime() -
              new Date().getTimezoneOffset() * 60000
          )
            .toISOString()
            .slice(0, 16)
        : ""
    );
    setCfgClubBase(auction.clubBasePrice);
    setCfgNonClubBase(auction.nonClubBasePrice);
    setCfgDefaultInc(auction.defaultIncrement);
    setCfgJumpInc(auction.jumpIncrement);
    setCfgRtmEnabled(auction.rtmEnabled);
  }, [auction]);

  useEffect(() => {
    if (!auction || !activeSport) return;
    const override = auction.sportBasePricesJson?.[String(activeSport.id)];
    setCfgSportClubBase(override?.clubBasePrice ?? auction.clubBasePrice);
    setCfgSportNonClubBase(override?.nonClubBasePrice ?? auction.nonClubBasePrice);
  }, [auction, activeSport]);

  useEffect(() => {
    if (
      !snapshot?.permissions.canManageConfig ||
      (adminTab !== "FRANCHISES" && adminTab !== "OPERATORS")
    ) {
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<{ students: typeof capOptions }>(
        `/api/roles/directory?q=${encodeURIComponent(capQuery.trim())}`
      )
        .then((res) => setCapOptions(res.students))
        .catch((err) => notifyToast("error", (err as Error).message || "Failed to search students."));
    }, 150);
    return () => clearTimeout(timer);
  }, [snapshot?.permissions.canManageConfig, adminTab, capQuery, notifyToast]);

  if (loading || !snapshot) {
    return <div className="max-w-7xl mx-auto p-8 text-sm text-[#8B8680]">Loading Prothymos Auction Hub...</div>;
  }

  if (!auction) {
    return <div className="max-w-5xl mx-auto p-8 text-sm text-[#8B8680]">No Prothymos auction configured yet.</div>;
  }

  const sportFranchises = snapshot.franchises.filter((f) => f.sportId === activeSport?.id);
  const sportPoolRaw = snapshot.registrations.filter((r) => r.sportId === activeSport?.id);
  const mySportReg = activeSport
    ? snapshot.myRegistrations.find((r) => r.sportId === activeSport.id) ?? null
    : null;
  const isClubInSelectedSport = Boolean(
    activeSport && snapshot.myInductedSportIds.includes(activeSport.id)
  );
  const effectiveSportPrices = activeSport
    ? auction.sportBasePricesJson?.[String(activeSport.id)] ?? {
        clubBasePrice: auction.clubBasePrice,
        nonClubBasePrice: auction.nonClubBasePrice,
      }
    : { clubBasePrice: auction.clubBasePrice, nonClubBasePrice: auction.nonClubBasePrice };
  const previewBasePrice = isClubInSelectedSport
    ? effectiveSportPrices.clubBasePrice
    : effectiveSportPrices.nonClubBasePrice;

  const availablePositions =
    (activeSport && SPORT_POSITIONS[activeSport.slug]) ?? ["All-Rounder", "Starter", "Specialist"];

  const myCaptainFranchises = user
    ? snapshot.franchises.filter((f) => f.captainUserId === user.id)
    : [];
  const activeSportCaptainFranchise =
    myCaptainFranchises.find((f) => f.sportId === activeSport?.id) ?? null;

  const filteredPool = sportPoolRaw
    .filter((p) => {
      const q = poolQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        (p.rollNumber ?? "").toLowerCase().includes(q) ||
        (p.branch ?? "").toLowerCase().includes(q) ||
        p.positionsJson.join(" ").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (poolSort === "BATCH") return a.batch.localeCompare(b.batch);
      if (poolSort === "BRANCH") return (a.branch ?? "").localeCompare(b.branch ?? "");
      if (poolSort === "BASE") return b.basePrice - a.basePrice;
      if (poolSort === "STATUS") return a.status.localeCompare(b.status);
      return a.displayName.localeCompare(b.displayName);
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch<{ photoUrl: string }>("/api/auction/upload-photo", {
        method: "POST",
        body: fd,
      });
      setPhotoUrl(res.photoUrl);
      notifyToast("success", "Portrait uploaded and validated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSport || submittingReg) return;
    if (selectedPositions.length === 0) {
      notifyToast("error", "Select at least 1 playing position.");
      return;
    }
    setSubmittingReg(true);
    try {
      await apiFetch("/api/auction/registrations", {
        method: "POST",
        body: JSON.stringify({
          sportId: activeSport.id,
          positionsJson: selectedPositions,
          experience: experience.trim() || null,
          achievements: achievements.trim() || null,
          photoUrl,
        }),
      });
      setSelectedPositions([]);
      setExperience("");
      setAchievements("");
      setPhotoUrl(null);
      await refresh();
      notifyToast("success", `Registered for ${activeSport.name} Auction!`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSport) return;
    try {
      const nextSportOverrides = {
        ...(auction.sportBasePricesJson ?? {}),
        [String(activeSport.id)]: {
          clubBasePrice: Number(cfgSportClubBase),
          nonClubBasePrice: Number(cfgSportNonClubBase),
        },
      };
      await apiFetch("/api/auction/config", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: auction.version,
          name: cfgName,
          status: cfgStatus,
          splitMode: cfgSplitMode,
          registrationDeadline: cfgDeadline ? new Date(cfgDeadline).toISOString() : null,
          clubBasePrice: Number(cfgClubBase),
          nonClubBasePrice: Number(cfgNonClubBase),
          sportBasePricesJson: nextSportOverrides,
          defaultIncrement: Number(cfgDefaultInc),
          jumpIncrement: Number(cfgJumpInc),
          rtmEnabled: cfgRtmEnabled,
        }),
      });
      await refresh();
      notifyToast("success", "Auction configuration saved.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleToggleNav = async (key: "showAuctionInNav" | "showLiveAuctionInNav", val: boolean) => {
    try {
      await apiFetch("/api/auction/config", {
        method: "PATCH",
        body: JSON.stringify({ [key]: val }),
      });
      await refreshAll();
      notifyToast("success", "Top navigation visibility updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleLifecycleTransition = async (nextStatus: "REGISTRATION_OPEN" | "FROZEN" | "LIVE") => {
    try {
      await apiFetch("/api/auction/config", {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          expectedVersion: auction.version,
        }),
      });
      await refresh();
      notifyToast(
        "success",
        nextStatus === "REGISTRATION_OPEN"
          ? "Auction registration opened."
          : nextStatus === "FROZEN"
          ? "Registration closed (FROZEN). Pool ready for review."
          : "Auction is now LIVE for stage bidding!"
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const startEditFranchise = (f: HydratedFranchise) => {
    setEditFranchise(f);
    setFName(f.name);
    setFCode(f.shortCode);
    setFColor(f.accentColor);
    setFPurse(f.startingPurse);
    setFMinSquad(f.minSquad);
    setFMaxSquad(f.maxSquad);
    setFMinClub(f.minClubQuota);
    setFMinNonClub(f.minNonClubQuota);
    setFCaptainId(f.captainUserId ?? "");
  };

  const handleSaveFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSport) return;
    try {
      const body = {
        sportId: activeSport.id,
        name: fName,
        shortCode: fCode,
        accentColor: fColor,
        captainUserId: fCaptainId === "" ? null : Number(fCaptainId),
        startingPurse: Number(fPurse),
        minSquad: Number(fMinSquad),
        maxSquad: Number(fMaxSquad),
        minClubQuota: Number(fMinClub),
        minNonClubQuota: Number(fMinNonClub),
      };
      if (editFranchise) {
        await apiFetch(`/api/auction/franchises/${editFranchise.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        notifyToast("success", "Franchise updated.");
      } else {
        await apiFetch("/api/auction/franchises", {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifyToast("success", "Franchise created.");
      }
      setEditFranchise(null);
      setFName("");
      setFCode("");
      await refresh();
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleDeleteFranchise = async (id: number) => {
    try {
      await apiFetch(`/api/auction/franchises/${id}`, { method: "DELETE" });
      await refresh();
      notifyToast("info", "Franchise removed.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleAddRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/auction/rounds", {
        method: "POST",
        body: JSON.stringify({ name: rName, roundOrder: Number(rOrder), roundType: rType }),
      });
      setRName("");
      await refresh();
      notifyToast("success", "Auction round created.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleActivateRound = async (id: number) => {
    try {
      await apiFetch(`/api/auction/rounds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: true }),
      });
      await refresh();
      notifyToast("success", "Active auction round updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleSavePlayerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    try {
      await apiFetch(`/api/auction/registrations/${editingPlayer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          playerClass: epClass,
          basePrice: Number(epBase),
          tier: epTier,
          status: epStatus,
          roundId: epRoundId === "" ? null : Number(epRoundId),
          positionsJson: epPositionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setEditingPlayer(null);
      await refresh();
      notifyToast("success", "Player registration updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleAddWatchlist = async (regId: number) => {
    if (!activeSportCaptainFranchise) return;
    try {
      await apiFetch("/api/auction/watchlist", {
        method: "POST",
        body: JSON.stringify({
          franchiseId: activeSportCaptainFranchise.id,
          auctionPlayerId: regId,
          priorityNote: watchNoteMap[regId] || null,
          maxTargetBid: watchBidMap[regId] ? Number(watchBidMap[regId]) : null,
        }),
      });
      await refresh();
      notifyToast("success", "Saved to Captain Watchlist.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleAssignOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOperatorId) {
      notifyToast("error", "Select a student to assign as Auction Operator.");
      return;
    }
    setOperatorBusy(true);
    try {
      await apiFetch("/api/auction/operators", {
        method: "POST",
        body: JSON.stringify({ userId: Number(selectedOperatorId) }),
      });
      setSelectedOperatorId("");
      setCapQuery("");
      await Promise.all([refresh(), refreshAll()]);
      notifyToast("success", "Auction Operator assigned for this Prothymos auction.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setOperatorBusy(false);
    }
  };

  const handleRevokeOperator = async (userId: number, name: string) => {
    setOperatorBusy(true);
    try {
      await apiFetch(`/api/auction/operators/${userId}`, {
        method: "DELETE",
      });
      await Promise.all([refresh(), refreshAll()]);
      notifyToast("success", `Revoked Auction Operator access from ${name}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setOperatorBusy(false);
    }
  };

  const handlePublishRostersToTournament = async () => {
    setPublishingRosters(true);
    try {
      const res = await apiFetch<{
        tournamentName: string;
        syncedTeamsCount: number;
        syncedPlayersCount: number;
      }>("/api/auction/publish-rosters", {
        method: "POST",
        body: JSON.stringify({ sportId: activeSport?.id }),
      });
      setPublishedTournamentName(res.tournamentName);
      await Promise.all([refresh(), refreshAll()]);
      notifyToast(
        "success",
        `Synced ${res.syncedTeamsCount} teams & ${res.syncedPlayersCount} roster slots to ${res.tournamentName}.`
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setPublishingRosters(false);
    }
  };

  const handleSubmitTeamRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSport) return;
    setSubmittingTeamReg(true);
    try {
      await apiFetch("/api/auction/team-registrations", {
        method: "POST",
        body: JSON.stringify({
          sportId: activeSport.id,
          teamName: regTeamName.trim(),
          shortCode: regShortCode.trim().toUpperCase(),
          accentColor: regTeamColor,
          rosterNotes: regTeamNotes.trim() || null,
        }),
      });
      setRegTeamName("");
      setRegShortCode("");
      setRegTeamNotes("");
      await refresh();
      notifyToast("success", "Team registration submitted for Sports Secretary approval.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setSubmittingTeamReg(false);
    }
  };

  const handleReviewTeamRegistration = async (
    regId: number,
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"
  ) => {
    setReviewingTeamId(regId);
    try {
      await apiFetch(`/api/auction/team-registrations/${regId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          startingPurse: reviewPurseMap[regId] || undefined,
          reviewNote: reviewNoteMap[regId]?.trim() || undefined,
        }),
      });
      await refresh();
      notifyToast("success", `Auction team registration ${decision}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setReviewingTeamId(null);
    }
  };

  const isPostAuction = auction.status === "COMPLETED" || auction.status === "PUBLISHED";
  const assignedOperators = snapshot.operators ?? [];
  const unsoldSportPlayers = sportPoolRaw.filter((p) => p.status === "UNSOLD");
  const allTeamRegistrations = snapshot.teamRegistrations ?? [];
  const pendingTeamRegistrations = allTeamRegistrations.filter(
    (tr) => tr.status === "PENDING_APPROVAL"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            Prothymos {auction.seasonYear} • Multi-Sport Auction Hub
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">{auction.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#8B8680] mt-1">
            <span className="px-2 py-0.5 rounded bg-[#B91C1C]/25 border border-[#B91C1C]/50 text-[#F5F2EB] font-bold">
              {auction.status}
            </span>
            {auction.registrationDeadline && (
              <span>Deadline: {formatIST(auction.registrationDeadline)}</span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[#D6CFC2]">
              <UserCheck className="w-3.5 h-3.5 text-[#D97706]" />
              Stage Operators:{" "}
              {assignedOperators.length > 0 ? (
                <span className="text-[#F59E0B] font-semibold">
                  {assignedOperators.map((op) => op.name).join(", ")}
                </span>
              ) : (
                <span className="text-[#8B8680]">Sports Secretary / Faculty Advisor only</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFinalRosterToggled(true);
              setShowFinalRoster((v) => !v);
            }}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${
              showFinalRoster
                ? "bg-[#D97706] text-[#08080A]"
                : isPostAuction
                ? "bg-[#10B981] text-[#08080A] ring-2 ring-[#10B981]/50"
                : "bg-[#141418] border border-[#10B981]/60 text-[#10B981] hover:bg-[#10B981]/10"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            {showFinalRoster ? "Auction Hub View" : isPostAuction ? "Final Roster (Ready)" : "Final Roster"}
          </button>
          <Link
            to="/live-auction"
            className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5" /> Open Live Stage
          </Link>
          <Link
            to="/live-auction/projector"
            className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 text-xs font-bold uppercase tracking-wider text-[#F59E0B]"
          >
            16:9 Projection
          </Link>
        </div>
      </div>

      {/* Sport Selector Bar */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {sportsList.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedSportId(s.id)}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeSport?.id === s.id
                ? "bg-[#B91C1C] text-[#F5F2EB]"
                : "bg-[#141418] text-[#D6CFC2] border border-white/10 hover:border-[#D97706]/50"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {showFinalRoster ? (
        <FinalRosterView
          auctionName={auction.name}
          seasonYear={auction.seasonYear}
          status={auction.status}
          sportName={activeSport?.name ?? "Multi-Sport"}
          franchises={sportFranchises}
          unsoldPlayers={unsoldSportPlayers}
          canPublishToTournament={snapshot.permissions.canManageConfig}
          onPublishToTournament={handlePublishRostersToTournament}
          publishingToTournament={publishingRosters}
          publishedTournamentName={publishedTournamentName}
        />
      ) : (
        <>

      {/* Sports Secretary Management Panel */}
      {snapshot.permissions.canManageConfig && (
        <section className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h2 className="font-editorial text-2xl text-[#D97706] flex items-center gap-2">
              <Settings className="w-5 h-5" /> Sports Secretary Auction Control Center
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(auction.status === "DRAFT" || auction.status === "FROZEN") && (
                <button
                  type="button"
                  onClick={() => handleLifecycleTransition("REGISTRATION_OPEN")}
                  className="px-3 py-1.5 rounded bg-[#10B981] hover:bg-[#059669] text-[#08080A] font-bold uppercase"
                >
                  Open Registration
                </button>
              )}
              {auction.status === "REGISTRATION_OPEN" && (
                <button
                  type="button"
                  onClick={() => handleLifecycleTransition("FROZEN")}
                  className="px-3 py-1.5 rounded bg-[#D97706] hover:bg-[#F59E0B] text-[#08080A] font-bold uppercase"
                >
                  Close Registration
                </button>
              )}
              {(auction.status === "REGISTRATION_OPEN" || auction.status === "FROZEN") && (
                <button
                  type="button"
                  onClick={() => handleLifecycleTransition("LIVE")}
                  className="px-3 py-1.5 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold uppercase"
                >
                  Start Live Auction
                </button>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(["CONFIG", "FRANCHISES", "ROUNDS", "POOL", "OPERATORS"] as AdminTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdminTab(t)}
                    className={`px-3 py-1.5 rounded font-bold uppercase ${
                      adminTab === t ? "bg-[#D97706] text-[#08080A]" : "bg-[#08080A] text-[#D6CFC2] border border-white/15"
                    }`}
                  >
                    {t === "OPERATORS" ? `OPERATORS (${assignedOperators.length})` : t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {adminTab === "CONFIG" && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Auction Title</label>
                  <input
                    value={cfgName}
                    onChange={(e) => setCfgName(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Lifecycle Status</label>
                  <select
                    value={cfgStatus}
                    onChange={(e) => setCfgStatus(e.target.value as typeof cfgStatus)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="REGISTRATION_OPEN">REGISTRATION_OPEN</option>
                    <option value="FROZEN">FROZEN</option>
                    <option value="LIVE">LIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Registration Deadline</label>
                  <input
                    type="datetime-local"
                    value={cfgDeadline}
                    onChange={(e) => setCfgDeadline(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[#D6CFC2] block mb-1">
                    Pre-Registration Pool Split Mode
                  </label>
                  <select
                    value={cfgSplitMode}
                    onChange={(e) => setCfgSplitMode(e.target.value as typeof cfgSplitMode)}
                    className="w-full sm:w-72 bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="COMBINED">COMBINED (Single Open Pool)</option>
                    <option value="SEPARATE_BOYS_GIRLS">SEPARATE_BOYS_GIRLS (Isolated Boys &amp; Girls Pools)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Global CLUB Base</label>
                  <input
                    type="number"
                    value={cfgClubBase}
                    onChange={(e) => setCfgClubBase(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Global NON_CLUB</label>
                  <input
                    type="number"
                    value={cfgNonClubBase}
                    onChange={(e) => setCfgNonClubBase(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D97706] block mb-1">{activeSport?.name} CLUB Base</label>
                  <input
                    type="number"
                    value={cfgSportClubBase}
                    onChange={(e) => setCfgSportClubBase(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-[#D97706]/40 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D97706] block mb-1">{activeSport?.name} NON_CLUB</label>
                  <input
                    type="number"
                    value={cfgSportNonClubBase}
                    onChange={(e) => setCfgSportNonClubBase(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-[#D97706]/40 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Step Increment</label>
                  <input
                    type="number"
                    value={cfgDefaultInc}
                    onChange={(e) => setCfgDefaultInc(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Jump Increment</label>
                  <input
                    type="number"
                    value={cfgJumpInc}
                    onChange={(e) => setCfgJumpInc(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-[#D6CFC2]">
                    <input
                      type="checkbox"
                      checked={cfgRtmEnabled}
                      onChange={(e) => setCfgRtmEnabled(e.target.checked)}
                    />
                    Enable RTM Cards
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleNav("showAuctionInNav", !bootstrap?.settings.showAuctionInNav)}
                    className={`px-3 py-1.5 rounded border font-semibold ${
                      bootstrap?.settings.showAuctionInNav
                        ? "bg-[#10B981]/15 border-[#10B981] text-[#10B981]"
                        : "bg-[#08080A] border-white/15 text-[#D6CFC2]"
                    }`}
                  >
                    Header AUCTION: {bootstrap?.settings.showAuctionInNav ? "ON" : "OFF"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleNav("showLiveAuctionInNav", !bootstrap?.settings.showLiveAuctionInNav)
                    }
                    className={`px-3 py-1.5 rounded border font-semibold ${
                      bootstrap?.settings.showLiveAuctionInNav
                        ? "bg-[#10B981]/15 border-[#10B981] text-[#10B981]"
                        : "bg-[#08080A] border-white/15 text-[#D6CFC2]"
                    }`}
                  >
                    Header LIVE AUCTION: {bootstrap?.settings.showLiveAuctionInNav ? "ON" : "OFF"}
                  </button>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase"
                >
                  Save Auction Config
                </button>
              </div>
            </form>
          )}

          {adminTab === "FRANCHISES" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <div className="space-y-2">
                <div className="font-bold uppercase text-[#D6CFC2]">
                  {activeSport?.name} Franchises ({sportFranchises.length})
                </div>
                {sportFranchises.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded bg-[#08080A] border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-[#F5F2EB] flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: f.accentColor }}
                        />
                        #{f.slotNumber} {f.name} ({f.shortCode})
                      </div>
                      <div className="text-[#8B8680]">
                        Captain: {f.captain?.name ?? "Unassigned"} • Purse: ₹{f.remainingPurse}/₹
                        {f.startingPurse} • Squad {f.minSquad}-{f.maxSquad} (CLUB ≥ {f.minClubQuota}, NON_CLUB ≥{" "}
                        {f.minNonClubQuota})
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditFranchise(f)}
                        className="p-1.5 rounded bg-white/10 hover:bg-[#D97706]/30"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFranchise(f.id)}
                        className="p-1.5 rounded bg-white/10 hover:bg-[#DC2626]/30 text-[#FCA5A5]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveFranchise} className="p-4 rounded bg-[#08080A] border border-white/10 space-y-3">
                <div className="font-bold uppercase text-[#D97706]">
                  {editFranchise ? `Edit ${editFranchise.name}` : `Add ${activeSport?.name} Franchise`}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    placeholder="Franchise Name"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    className="col-span-2 bg-[#141418] border border-white/15 rounded px-2.5 py-1.5"
                  />
                  <input
                    required
                    maxLength={6}
                    placeholder="CODE"
                    value={fCode}
                    onChange={(e) => setFCode(e.target.value.toUpperCase())}
                    className="bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 uppercase font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Starting Purse (₹)</label>
                    <input
                      type="number"
                      value={fPurse}
                      onChange={(e) => setFPurse(Number(e.target.value))}
                      className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Accent Color</label>
                    <input
                      type="color"
                      value={fColor}
                      onChange={(e) => setFColor(e.target.value)}
                      className="w-full h-8 bg-[#141418] border border-white/15 rounded px-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Min Sq</label>
                    <input type="number" value={fMinSquad} onChange={(e) => setFMinSquad(Number(e.target.value))} className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Max Sq</label>
                    <input type="number" value={fMaxSquad} onChange={(e) => setFMaxSquad(Number(e.target.value))} className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Min CLUB</label>
                    <input type="number" value={fMinClub} onChange={(e) => setFMinClub(Number(e.target.value))} className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8680] block mb-1">Min NON</label>
                    <input type="number" value={fMinNonClub} onChange={(e) => setFMinNonClub(Number(e.target.value))} className="w-full bg-[#141418] border border-white/15 rounded px-2 py-1 font-mono" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8B8680] block">Captain (Student Search)</label>
                  <input
                    type="text"
                    value={capQuery}
                    onChange={(e) => setCapQuery(e.target.value)}
                    placeholder="Filter students..."
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-1.5"
                  />
                  <select
                    value={fCaptainId}
                    onChange={(e) => setFCaptainId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-[#141418] border border-white/15 rounded px-2.5 py-1.5"
                  >
                    <option value="">Unassigned</option>
                    {capOptions.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name} ({s.rollNumber ?? s.batch} · {s.batch} {s.branch ?? ""})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  {editFranchise && (
                    <button type="button" onClick={() => setEditFranchise(null)} className="px-3 py-1.5 rounded bg-white/10">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] font-bold uppercase">
                    {editFranchise ? "Save Franchise" : "Create Franchise"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {adminTab === "ROUNDS" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <div className="space-y-2">
                {snapshot.rounds.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded bg-[#08080A] border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#F5F2EB]">
                        #{r.roundOrder} {r.name}
                      </div>
                      <div className="text-[#8B8680]">{r.roundType}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleActivateRound(r.id)}
                      className={`px-3 py-1 rounded font-bold uppercase ${
                        r.active ? "bg-[#10B981] text-[#08080A]" : "bg-white/10 text-[#D6CFC2]"
                      }`}
                    >
                      {r.active ? "Active Round" : "Set Active"}
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddRound} className="p-4 rounded bg-[#08080A] border border-white/10 space-y-3">
                <div className="font-bold uppercase text-[#D97706]">Add Auction Round</div>
                <input
                  required
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="e.g., Round 4 — Final Re-Auction"
                  className="w-full bg-[#141418] border border-white/15 rounded px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={rOrder}
                    onChange={(e) => setROrder(Number(e.target.value))}
                    className="bg-[#141418] border border-white/15 rounded px-2.5 py-1.5 font-mono"
                  />
                  <select
                    value={rType}
                    onChange={(e) => setRType(e.target.value as typeof rType)}
                    className="bg-[#141418] border border-white/15 rounded px-2.5 py-1.5"
                  >
                    <option value="MAIN">MAIN</option>
                    <option value="ACCELERATED">ACCELERATED</option>
                    <option value="UNSOLD">UNSOLD</option>
                    <option value="RTM">RTM</option>
                  </select>
                </div>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] font-bold uppercase flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Round
                </button>
              </form>
            </div>
          )}

          {adminTab === "POOL" && (
            <div className="text-xs text-[#D6CFC2]">
              Use the Player Pool table below to search, sort, or click <strong className="text-[#D97706]">Edit</strong> on any registered player.
            </div>
          )}

          {adminTab === "OPERATORS" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-wider text-[#D97706]">
                    Assigned Auction Operators ({assignedOperators.length})
                  </h3>
                  <Link
                    to="/roles"
                    className="text-[11px] text-[#F59E0B] hover:underline font-semibold"
                  >
                    Role Requests Queue →
                  </Link>
                </div>
                <p className="text-[11px] text-[#8B8680]">
                  Assigned operators can run the Live Auction Stage (call bids, mark SOLD/UNSOLD, undo, RTM, and switch stage sport/round) for this auction alongside the Sports Secretary and Faculty Advisor.
                </p>
                {assignedOperators.length === 0 ? (
                  <div className="p-3 rounded bg-[#08080A] border border-white/10 text-[#8B8680]">
                    No dedicated AUCTION_OPERATOR assigned yet. Assign a student operator on the right.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedOperators.map((op) => (
                      <div
                        key={op.roleId}
                        className="p-3 rounded bg-[#08080A] border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-[#F5F2EB] flex items-center gap-2">
                            {op.name}
                            <span className="px-1.5 py-0.5 rounded bg-[#D97706]/20 text-[#F59E0B] font-mono text-[10px]">
                              {op.roleCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8B8680]">
                            {op.rollNumber ?? "Student"} · {op.batch}
                            {op.auctionId ? " • Event Scoped" : " • Global"}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={operatorBusy}
                          onClick={() => handleRevokeOperator(op.userId, op.name)}
                          className="px-2.5 py-1.5 rounded bg-[#DC2626]/20 hover:bg-[#DC2626]/35 border border-[#DC2626]/50 text-[#FCA5A5] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                        >
                          <UserMinus className="w-3.5 h-3.5" /> Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleAssignOperator}
                className="p-4 rounded bg-[#08080A] border border-white/10 space-y-3"
              >
                <div className="font-bold uppercase text-[#D97706]">Assign Auction Operator</div>
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">
                    Search Student (Name / Roll Number)
                  </label>
                  <input
                    value={capQuery}
                    onChange={(e) => setCapQuery(e.target.value)}
                    placeholder="Type student name or roll no..."
                    className="w-full bg-[#141418] border border-white/15 rounded px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#D6CFC2] block mb-1">Select Student</label>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) =>
                      setSelectedOperatorId(e.target.value ? Number(e.target.value) : "")
                    }
                    className="w-full bg-[#141418] border border-white/15 rounded px-3 py-2 text-xs"
                  >
                    <option value="">-- Choose student for AUCTION_OPERATOR --</option>
                    {capOptions.map((st) => {
                      const alreadyAssigned = assignedOperators.some(
                        (op) => op.userId === st.userId
                      );
                      return (
                        <option
                          key={st.userId}
                          value={st.userId}
                          disabled={alreadyAssigned}
                        >
                          {st.name} ({st.rollNumber ?? st.batch}
                          {st.branch ? ` • ${st.branch}` : ""})
                          {alreadyAssigned ? " [Already Assigned]" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={operatorBusy || !selectedOperatorId}
                  className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Assign Auction Operator
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Team Registration Approvals Queue (Sports Secretary / Faculty Advisor) */}
      {snapshot.permissions.canManageConfig && allTeamRegistrations.length > 0 && (
        <section className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <h2 className="font-editorial text-2xl text-[#D97706] flex items-center gap-2">
              <Shield className="w-5 h-5" /> Team Registration Approvals ({pendingTeamRegistrations.length} Pending)
            </h2>
            <span className="text-[11px] text-[#8B8680]">
              Only APPROVED teams appear in active live auction bidding.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {allTeamRegistrations.map((tr) => (
              <div
                key={tr.id}
                className="p-3.5 rounded bg-[#08080A] border border-white/10 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-[#F5F2EB] flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: tr.accentColor }}
                      />
                      {tr.teamName} ({tr.shortCode})
                    </div>
                    <div className="text-[11px] text-[#8B8680]">
                      {tr.sportName} • Captain: {tr.captainName ?? "TBD"} • Submitted by {tr.submitterName}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      tr.status === "APPROVED"
                        ? "bg-[#10B981]/20 text-[#10B981]"
                        : tr.status === "PENDING_APPROVAL"
                        ? "bg-[#D97706]/20 text-[#F59E0B]"
                        : "bg-[#DC2626]/20 text-[#FCA5A5]"
                    }`}
                  >
                    {tr.status}
                  </span>
                </div>
                {tr.rosterNotes && <p className="text-[11px] text-[#D6CFC2]">{tr.rosterNotes}</p>}
                {tr.status !== "APPROVED" && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Purse ₹ (default 20000)"
                        value={reviewPurseMap[tr.id] ?? ""}
                        onChange={(e) =>
                          setReviewPurseMap((prev) => ({
                            ...prev,
                            [tr.id]: Number(e.target.value),
                          }))
                        }
                        className="bg-[#141418] border border-white/15 rounded px-2 py-1 text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Review note (optional)"
                        value={reviewNoteMap[tr.id] ?? ""}
                        onChange={(e) =>
                          setReviewNoteMap((prev) => ({
                            ...prev,
                            [tr.id]: e.target.value,
                          }))
                        }
                        className="bg-[#141418] border border-white/15 rounded px-2 py-1 text-[11px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={reviewingTeamId === tr.id}
                        onClick={() => handleReviewTeamRegistration(tr.id, "APPROVED")}
                        className="px-3 py-1 rounded bg-[#10B981] text-[#08080A] font-bold uppercase text-[10px]"
                      >
                        Approve &amp; Activate
                      </button>
                      <button
                        type="button"
                        disabled={reviewingTeamId === tr.id}
                        onClick={() => handleReviewTeamRegistration(tr.id, "CHANGES_REQUESTED")}
                        className="px-3 py-1 rounded bg-[#D97706]/25 border border-[#D97706]/50 text-[#F59E0B] font-bold uppercase text-[10px]"
                      >
                        Request Changes
                      </button>
                      <button
                        type="button"
                        disabled={reviewingTeamId === tr.id}
                        onClick={() => handleReviewTeamRegistration(tr.id, "REJECTED")}
                        className="px-3 py-1 rounded bg-[#DC2626]/25 border border-[#DC2626]/50 text-[#FCA5A5] font-bold uppercase text-[10px]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Grid: Student Registration + Captain War Room */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Self-Registration Card */}
        <section className="rdr-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="font-editorial text-2xl text-[#F5F2EB]">
              {activeSport?.name} Registration
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                isClubInSelectedSport
                  ? "bg-[#10B981]/20 text-[#10B981]"
                  : "bg-[#D97706]/20 text-[#F59E0B]"
              }`}
            >
              {isClubInSelectedSport ? "CLUB" : "NON_CLUB"} · ₹{previewBasePrice}
            </span>
          </div>

          {!user ? (
            <p className="text-xs text-[#8B8680]">
              Sign in with your <span className="text-[#D97706]">@iiitt.ac.in</span> student account to register for {activeSport?.name}.
            </p>
          ) : snapshot.permissions.isActiveCaptain || snapshot.permissions.isCaptain || Boolean(activeSportCaptainFranchise) ? (
            <div className="p-4 rounded bg-[#D97706]/10 border border-[#D97706]/50 space-y-1.5 text-xs">
              <div className="font-bold text-[#F59E0B] uppercase">
                Captain Restriction — Cannot Register as Player
              </div>
              <p className="text-[#D6CFC2]">
                Active franchise/team captains cannot register as biddable players in the Prothymos auction. Use the Captain War Room and Final Roster views to manage your franchise.
              </p>
            </div>
          ) : !snapshot.permissions.canRegister ? (
            <p className="text-xs text-[#8B8680]">
              Only verified student accounts can self-register into the Prothymos player pool.
            </p>
          ) : mySportReg ? (
            <div className="p-4 rounded bg-[#08080A] border border-[#10B981]/40 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#10B981] font-bold">
                <CheckCircle2 className="w-4 h-4" /> Registered for {activeSport?.name}
              </div>
              <div>
                Class: <span className="font-bold text-[#F5F2EB]">{mySportReg.playerClass}</span> • Base Price:{" "}
                <span className="font-mono text-[#D97706]">₹{mySportReg.basePrice}</span>
              </div>
              <div>Positions: {mySportReg.positionsJson.join(", ")}</div>
              <div>
                Status: <span className="font-mono text-[#F59E0B]">{mySportReg.status}</span>
                {mySportReg.soldPrice ? ` (Sold ₹${mySportReg.soldPrice})` : ""}
              </div>
              <p className="text-[11px] text-[#8B8680] pt-1">
                One registration per sport enforced. Switch sport tabs above to register separately for another sport.
              </p>
            </div>
          ) : auction.status !== "REGISTRATION_OPEN" ? (
            <div className="p-4 rounded bg-[#08080A] border border-white/15 space-y-1.5 text-xs">
              <div className="font-bold text-[#D97706] uppercase">Auction Registration Closed</div>
              <p className="text-[#8B8680]">
                Student self-registration is currently closed (status: <span className="font-mono text-[#F5F2EB]">{auction.status}</span>).
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <div className="text-[11px] text-[#D6CFC2] mb-1.5">
                  Playing Positions in {activeSport?.name} (select 1 or more)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availablePositions.map((pos) => {
                    const checked = selectedPositions.includes(pos);
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          setSelectedPositions((prev) =>
                            checked ? prev.filter((p) => p !== pos) : [...prev, pos]
                          )
                        }
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                          checked
                            ? "bg-[#B91C1C]/30 border-[#DC2626] text-[#F5F2EB]"
                            : "bg-[#08080A] border-white/15 text-[#D6CFC2]"
                        }`}
                      >
                        {checked ? "✓ " : ""}
                        {pos}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#D6CFC2] block mb-1">Player Portrait Photo</label>
                <div className="flex items-center gap-3">
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt="Player portrait preview"
                      className="w-12 h-12 rounded object-cover border border-[#D97706]/60"
                    />
                  )}
                  <label className="px-3 py-1.5 rounded bg-[#08080A] border border-white/15 hover:border-[#D97706] text-xs cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#D97706]" />
                    {uploadingPhoto ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#D6CFC2] block mb-1">Experience</label>
                <input
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g., Inter-IIIT camp, hostel captain..."
                  className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#D6CFC2] block mb-1">Key Achievements</label>
                <input
                  type="text"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  placeholder="Optional stats or tournament awards"
                  className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReg || selectedPositions.length === 0}
                className="w-full py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] disabled:opacity-50 text-xs font-bold uppercase tracking-wider"
              >
                {submittingReg ? "Registering..." : `Register for ${activeSport?.name} (₹${previewBasePrice})`}
              </button>
            </form>
          )}

          {/* Register Team for Auction (Pending Sports Secretary Approval) */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-xl text-[#D97706]">
                Register Team for {activeSport?.name} Auction
              </h3>
              <span className="text-[10px] font-mono text-[#8B8680]">REQUIRES APPROVAL</span>
            </div>
            {!user ? (
              <p className="text-xs text-[#8B8680]">Sign in to propose a franchise team for approval.</p>
            ) : (
              <form onSubmit={handleSubmitTeamRegistration} className="space-y-2.5 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    value={regTeamName}
                    onChange={(e) => setRegTeamName(e.target.value)}
                    placeholder="Team Name"
                    className="col-span-2 bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5"
                  />
                  <input
                    required
                    maxLength={8}
                    value={regShortCode}
                    onChange={(e) => setRegShortCode(e.target.value.toUpperCase())}
                    placeholder="Code (e.g. GGL)"
                    className="bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={regTeamColor}
                    onChange={(e) => setRegTeamColor(e.target.value)}
                    className="w-9 h-8 bg-transparent border border-white/15 rounded"
                  />
                  <input
                    value={regTeamNotes}
                    onChange={(e) => setRegTeamNotes(e.target.value)}
                    placeholder="Captain / initial roster notes (optional)"
                    className="flex-1 bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingTeamReg}
                  className="w-full py-2 rounded bg-[#141418] border border-[#D97706]/60 hover:bg-[#D97706]/15 text-[#F59E0B] font-bold uppercase"
                >
                  {submittingTeamReg ? "Submitting..." : "Submit Team for Approval"}
                </button>
              </form>
            )}

            {allTeamRegistrations.filter((tr) => !snapshot.permissions.canManageConfig || tr.submittedByUserId === user?.id).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] uppercase tracking-wider text-[#8B8680] font-bold">
                  Your Team Submissions
                </div>
                {allTeamRegistrations
                  .filter((tr) => !snapshot.permissions.canManageConfig || tr.submittedByUserId === user?.id)
                  .map((tr) => (
                    <div
                      key={tr.id}
                      className="p-2 rounded bg-[#08080A] border border-white/10 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div>
                        <span className="font-semibold text-[#F5F2EB]">
                          {tr.teamName} ({tr.shortCode})
                        </span>{" "}
                        <span className="text-[#8B8680]">· {tr.sportName}</span>
                        {tr.reviewNote && <div className="text-[10px] text-[#8B8680]">{tr.reviewNote}</div>}
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                          tr.status === "APPROVED"
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : tr.status === "PENDING_APPROVAL"
                            ? "bg-[#D97706]/20 text-[#F59E0B]"
                            : "bg-[#DC2626]/20 text-[#FCA5A5]"
                        }`}
                      >
                        {tr.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* My Registrations Across Sports */}
          {snapshot.myRegistrations.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-[#D97706] font-bold">
                My Registrations ({snapshot.myRegistrations.length})
              </div>
              {snapshot.myRegistrations.map((mr) => {
                const sp = sportsList.find((s) => s.id === mr.sportId);
                return (
                  <div key={mr.id} className="p-2 rounded bg-[#08080A] border border-white/10 flex items-center justify-between text-xs">
                    <span>
                      <strong>{sp?.name}</strong> • {mr.playerClass}
                    </span>
                    <span className="font-mono text-[#F59E0B]">{mr.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Franchises Overview + Captain War Room */}
        <section className="lg:col-span-2 rdr-panel rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#D97706]" /> {activeSport?.name} Franchises &amp; Purses
            </h2>
            <span className="text-[11px] text-[#8B8680]">
              Per-sport isolated purses, quotas &amp; max legal bids
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sportFranchises.map((f) => {
              const isMine = user?.id === f.captainUserId;
              return (
                <div
                  key={f.id}
                  className={`p-3.5 rounded bg-[#08080A] border space-y-2 ${
                    isMine ? "border-[#D97706]" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-[#F5F2EB] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.accentColor }} />
                      {f.name} ({f.shortCode})
                    </div>
                    <span className="font-mono text-sm font-bold text-[#10B981]">
                      ₹{f.remainingPurse.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8B8680] flex flex-wrap justify-between gap-2">
                    <span>Captain: {f.captain?.name ?? "TBD"}</span>
                    <span className="font-mono">
                      Squad {f.squadCount}/{f.maxSquad} (Min {f.minSquad})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#D6CFC2] flex justify-between font-mono">
                    <span>
                      CLUB {f.clubCount}/{f.minClubQuota} • NON {f.nonClubCount}/{f.minNonClubQuota}
                    </span>
                    <span className="text-[#F59E0B]">Max Bid: ₹{f.maxAllowedBid.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {activeSportCaptainFranchise && (
            <div className="p-3.5 rounded bg-[#141418] border border-[#D97706]/40 space-y-2">
              <div className="text-xs font-bold uppercase text-[#D97706] flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" /> Captain War-Room Watchlist —{" "}
                {activeSportCaptainFranchise.name}
              </div>
              {snapshot.myWatchlist.filter((w) => w.franchiseId === activeSportCaptainFranchise.id).length === 0 ? (
                <p className="text-xs text-[#8B8680]">
                  Bookmark players from the {activeSport?.name} pool below with your target max bid.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {snapshot.myWatchlist
                    .filter((w) => w.franchiseId === activeSportCaptainFranchise.id)
                    .map((w) => {
                      const pl = snapshot.registrations.find((r) => r.id === w.auctionPlayerId);
                      return (
                        <div key={w.id} className="px-2.5 py-1.5 rounded bg-[#08080A] border border-white/15 text-xs flex items-center gap-2">
                          <span className="font-semibold text-[#F5F2EB]">{pl?.displayName ?? `#${w.auctionPlayerId}`}</span>
                          {w.maxTargetBid && <span className="font-mono text-[#D97706]">Max ₹{w.maxTargetBid}</span>}
                          {w.priorityNote && <span className="text-[11px] text-[#8B8680]">({w.priorityNote})</span>}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/auction/watchlist/${w.id}`, { method: "DELETE" });
                                await refresh();
                                notifyToast("info", "Removed from watchlist.");
                              } catch (err) {
                                notifyToast("error", (err as Error).message);
                              }
                            }}
                            title="Remove from watchlist"
                            className="text-[#8B8680] hover:text-[#DC2626] font-bold px-1"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Per-Sport Player Pool Table */}
      <section className="rdr-panel rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D97706]" /> {activeSport?.name} Player Pool ({filteredPool.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-2.5 top-2" />
              <input
                type="text"
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder="Search name, roll, branch, position..."
                className="bg-[#08080A] border border-white/15 rounded pl-8 pr-3 py-1.5"
              />
            </div>
            <select
              value={poolSort}
              onChange={(e) => setPoolSort(e.target.value as typeof poolSort)}
              className="bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5"
            >
              <option value="NAME">Sort: Name</option>
              <option value="BATCH">Sort: Year</option>
              <option value="BRANCH">Sort: Branch</option>
              <option value="BASE">Sort: Base Price</option>
              <option value="STATUS">Sort: Status</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[#8B8680] border-b border-white/10 uppercase">
              <tr>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 px-2">Year / Branch</th>
                <th className="py-2 px-2">Positions</th>
                <th className="py-2 px-2">Class</th>
                <th className="py-2 px-2">Tier</th>
                <th className="py-2 px-2 text-right">Base</th>
                <th className="py-2 px-2">Status</th>
                {(snapshot.permissions.canManageConfig || activeSportCaptainFranchise) && (
                  <th className="py-2 pl-2 text-right">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPool.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="py-2.5 pr-3">
                    <Link to={`/players/${p.playerProfileId}`} className="font-semibold text-[#F5F2EB] hover:text-[#D97706]">
                      {p.displayName}
                    </Link>
                    {p.rollNumber && (
                      <div className="font-mono text-[10px] text-[#8B8680]">{p.rollNumber}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-[#D6CFC2]">
                    {p.batch} • {p.branch ?? "IIITT"}
                  </td>
                  <td className="py-2.5 px-2">{p.positionsJson.join(", ")}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.playerClass === "CLUB"
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : "bg-[#D97706]/20 text-[#F59E0B]"
                      }`}
                    >
                      {p.playerClass}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-mono">{p.tier}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#D97706]">₹{p.basePrice}</td>
                  <td className="py-2.5 px-2 font-mono">
                    {p.status}
                    {p.soldPrice ? ` (₹${p.soldPrice})` : ""}
                  </td>
                  {(snapshot.permissions.canManageConfig || activeSportCaptainFranchise) && (
                    <td className="py-2.5 pl-2 text-right space-x-1.5">
                      {activeSportCaptainFranchise && (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            placeholder="Max ₹"
                            value={watchBidMap[p.id] ?? ""}
                            onChange={(e) =>
                              setWatchBidMap((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            className="w-16 bg-[#08080A] border border-white/15 rounded px-1.5 py-1 text-[10px] font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Note"
                            value={watchNoteMap[p.id] ?? ""}
                            onChange={(e) =>
                              setWatchNoteMap((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            className="w-24 bg-[#08080A] border border-white/15 rounded px-1.5 py-1 text-[10px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddWatchlist(p.id)}
                            className="px-2 py-1 rounded bg-white/10 hover:bg-[#D97706]/30 text-[10px]"
                          >
                            + Watch
                          </button>
                        </span>
                      )}
                      {snapshot.permissions.canManageConfig && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlayer(p);
                            setEpClass(p.playerClass);
                            setEpBase(p.basePrice);
                            setEpTier(p.tier);
                            setEpStatus(p.status);
                            setEpRoundId(p.roundId ?? "");
                            setEpPositionsText(p.positionsJson.join(", "));
                          }}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-[#B91C1C]/40 text-[10px] font-semibold"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}

      {/* Edit Registered Player Modal (Sports Secretary) */}
      {editingPlayer && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#F5F2EB]">
              Edit {editingPlayer.displayName}
            </h3>
            <form onSubmit={handleSavePlayerEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Class</label>
                  <select
                    value={epClass}
                    onChange={(e) => setEpClass(e.target.value as typeof epClass)}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="CLUB">CLUB</option>
                    <option value="NON_CLUB">NON_CLUB</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    value={epBase}
                    onChange={(e) => setEpBase(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Tier</label>
                  <select value={epTier} onChange={(e) => setEpTier(e.target.value as typeof epTier)} className="w-full bg-[#08080A] border border-white/15 rounded px-2 py-2">
                    <option value="MARQUEE">MARQUEE</option>
                    <option value="TIER_1">TIER_1</option>
                    <option value="STANDARD">STANDARD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Status</label>
                  <select value={epStatus} onChange={(e) => setEpStatus(e.target.value as typeof epStatus)} className="w-full bg-[#08080A] border border-white/15 rounded px-2 py-2">
                    <option value="REGISTERED">REGISTERED</option>
                    <option value="ELIGIBLE">ELIGIBLE</option>
                    <option value="UNSOLD">UNSOLD</option>
                    <option value="INELIGIBLE">INELIGIBLE</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#D6CFC2] block mb-1">Round</label>
                  <select value={epRoundId} onChange={(e) => setEpRoundId(e.target.value ? Number(e.target.value) : "")} className="w-full bg-[#08080A] border border-white/15 rounded px-2 py-2">
                    <option value="">Default</option>
                    {snapshot.rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.roundOrder}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#D6CFC2] block mb-1">Positions (comma-separated)</label>
                <input
                  value={epPositionsText}
                  onChange={(e) => setEpPositionsText(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingPlayer(null)} className="px-3 py-1.5 rounded bg-white/10">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] font-bold uppercase">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
