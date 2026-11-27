import React, { useCallback, useEffect, useState } from "react";
import { Shield, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";
import { UrgentBannerEditor } from "../components/UrgentBannerEditor.tsx";

interface StudentEntry {
  userId: number;
  name: string;
  rollNumber: string | null;
  batch: string;
  branch: string | null;
}

interface RoleReqRow {
  id: number;
  requestedRole: string;
  action: "APPOINT" | "REMOVE";
  clubId: number | null;
  batchScope: string | null;
  scopeLabel: string | null;
  matchId: number | null;
  matchLabel: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  clubName: string | null;
  createdAt: string;
  requester: { name: string } | null;
  target: { name: string; batch: string } | null;
}

interface MatchOption {
  id: number;
  status: string;
  roundLabel: string;
  sport: { name: string } | null;
  teamA: { shortCode: string } | null;
  teamB: { shortCode: string } | null;
}

export function RolesPage() {
  const { user, bootstrap, hasRole, hasGlobalSportsAuthority, notifyToast, refreshAll } = useApp();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [clubs, setClubs] = useState<Array<{ id: number; name: string }>>([]);
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([]);
  const [requests, setRequests] = useState<RoleReqRow[]>([]);
  const [holders, setHolders] = useState<
    Array<{
      id: number;
      userId: number;
      roleCode: string;
      clubName: string | null;
      batchScope: string | null;
      scopeLabel: string | null;
      matchId: number | null;
      userName: string;
      rollNumber: string | null;
      batch: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [rolloverTerm, setRolloverTerm] = useState("EVEN_2027");
  const [rolloverBusy, setRolloverBusy] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<{
    term: string;
    advancedCount: number;
    graduatedCount: number;
    skippedCount: number;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: number; action: string; entityType: string; entityId: string; actorName: string | null; createdAt: string }>
  >([]);

  // Request Form
  const [studentQuery, setStudentQuery] = useState("");
  const [targetUserId, setTargetUserId] = useState<number>(0);
  const [requestedRole, setRequestedRole] = useState<
    "CLUB_SECRETARY" | "CLUB_COORDINATOR" | "MATCH_SCORER" | "AUCTION_OPERATOR"
  >("MATCH_SCORER");
  const [action, setAction] = useState<"APPOINT" | "REMOVE">("APPOINT");
  const [clubId, setClubId] = useState<number>(0);
  const [batchScope, setBatchScope] = useState("ALL");
  const [scopeLabel, setScopeLabel] = useState("");
  const [targetMatchId, setTargetMatchId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [handoverUserId, setHandoverUserId] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [clubsRes, matchesRes] = await Promise.all([
        apiFetch<{ clubs: Array<{ id: number; name: string }> }>("/api/clubs"),
        apiFetch<{ liveMatches: MatchOption[]; upcomingMatches: MatchOption[] }>("/api/matches"),
      ]);
      setClubs(clubsRes.clubs);
      if (clubsRes.clubs.length > 0 && clubId === 0) setClubId(clubsRes.clubs[0].id);

      const activeMatches = [
        ...(matchesRes.liveMatches ?? []),
        ...(matchesRes.upcomingMatches ?? []),
      ];
      setAvailableMatches(activeMatches);
      setTargetMatchId((prev) =>
        prev === null ? (activeMatches[0] ? String(activeMatches[0].id) : "") : prev
      );

      if (!user) return;
      const [dirRes, reqRes] = await Promise.all([
        apiFetch<{ students: StudentEntry[] }>(
          `/api/roles/directory?q=${encodeURIComponent(studentQuery.trim())}`
        ),
        apiFetch<{ requests: RoleReqRow[] }>("/api/roles/requests"),
      ]);
      setStudents(dirRes.students);
      setRequests(reqRes.requests);
      if (dirRes.students.length > 0 && handoverUserId === 0) {
        setHandoverUserId(dirRes.students[0].userId);
      }

      if (hasGlobalSportsAuthority) {
        const [auditRes, holdersRes] = await Promise.all([
          apiFetch<{ logs: typeof auditLogs }>("/api/roles/audit-logs"),
          apiFetch<{ holders: typeof holders }>("/api/roles/holders"),
        ]);
        setAuditLogs(auditRes.logs);
        setHolders(holdersRes.holders);
      } else {
        setHolders([]);
      }
    } catch (err) {
      setLoadError((err as Error).message || "Failed to load governance data.");
    } finally {
      setLoading(false);
    }
  }, [user, hasGlobalSportsAuthority, clubId, handoverUserId, studentQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) {
      notifyToast("error", "Please select a Target Student before submitting.");
      return;
    }
    try {
      await apiFetch("/api/roles/requests", {
        method: "POST",
        body: JSON.stringify({
          targetUserId,
          requestedRole,
          action,
          clubId:
            requestedRole === "MATCH_SCORER" || requestedRole === "AUCTION_OPERATOR" ? null : clubId,
          batchScope: requestedRole === "CLUB_COORDINATOR" ? batchScope : null,
          scopeLabel: requestedRole === "CLUB_COORDINATOR" ? scopeLabel.trim() || null : null,
          matchId:
            requestedRole === "MATCH_SCORER" && targetMatchId ? Number(targetMatchId) : null,
          reason,
        }),
      });
      setReason("");
      setScopeLabel("");
      await loadData();
      notifyToast("success", "Role request submitted to Sports Secretary approval queue.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const reviewRequest = async (id: number, decision: "APPROVED" | "REJECTED") => {
    try {
      await apiFetch(`/api/roles/requests/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      await loadData();
      await refreshAll();
      notifyToast("success", `Request ${decision}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const toggleNavFlag = async (key: "showAuctionInNav" | "showLiveAuctionInNav", val: boolean) => {
    try {
      await apiFetch("/api/settings/nav", {
        method: "PATCH",
        body: JSON.stringify({ [key]: val }),
      });
      await refreshAll();
      notifyToast("success", "Navigation visibility updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleHandover = async () => {
    try {
      await apiFetch("/api/roles/handover-secretary", {
        method: "POST",
        body: JSON.stringify({ newSecretaryUserId: handoverUserId }),
      });
      await loadData();
      await refreshAll();
      notifyToast("success", "Sports Secretary authority handed over.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const handleRevokeHolder = async (roleId: number) => {
    setRevokingId(roleId);
    try {
      await apiFetch(`/api/roles/holders/${roleId}`, { method: "DELETE" });
      await Promise.all([loadData(), refreshAll()]);
      notifyToast("info", "Role assignment revoked.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setRevokingId(null);
    }
  };

  const handleSemesterRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rolloverTerm.trim() || rolloverBusy) return;
    setRolloverBusy(true);
    try {
      const res = await apiFetch<{
        term: string;
        advancedCount: number;
        graduatedCount: number;
        skippedCount: number;
      }>("/api/roles/semester-rollover", {
        method: "POST",
        body: JSON.stringify({ term: rolloverTerm.trim() }),
      });
      setRolloverResult(res);
      await loadData();
      notifyToast(
        "success",
        `Term ${res.term} rollover complete: ${res.advancedCount} advanced, ${res.graduatedCount} graduated.`
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setRolloverBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b border-white/10 pb-4">
        <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
          Institute Governance &amp; RBAC
        </div>
        <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">
          Roles, Scorers &amp; Approval Queue
        </h1>
      </div>

      {loading ? (
        <div className="rdr-panel rounded-lg p-6 text-sm text-[#8B8680]">
          Loading institute governance &amp; approval queue...
        </div>
      ) : loadError ? (
        <div className="rdr-panel rounded-lg p-6 border border-[#DC2626]/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#FCA5A5]">{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-3.5 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase text-[#F5F2EB]"
          >
            Retry
          </button>
        </div>
      ) : !user ? (
        <div className="rdr-panel rounded-lg p-6 text-sm text-[#D6CFC2]">
          Sign in with your <span className="text-[#D97706]">@iiitt.ac.in</span> account to submit or review role requests.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Appoint / Remove Role */}
            <section className="rdr-panel rounded-lg p-5 space-y-4">
              <h2 className="font-editorial text-2xl flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D97706]" /> Request Role Appointment or Removal
              </h2>
              <p className="text-xs text-[#8B8680]">
                Match Scorers and Club Secretaries can only be approved by the Sports Secretary (or Faculty Advisor).
              </p>
              <form onSubmit={submitRequest} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Action</label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value as "APPOINT" | "REMOVE")}
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      <option value="APPOINT">Appoint</option>
                      <option value="REMOVE">Remove / Change</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">Role</label>
                    <select
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as typeof requestedRole)}
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      <option value="MATCH_SCORER">Match Scorer</option>
                      <option value="AUCTION_OPERATOR">Auction Operator</option>
                      <option value="CLUB_COORDINATOR">Club Coordinator</option>
                      <option value="CLUB_SECRETARY">Club Secretary</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-[#D6CFC2]">
                      Target Student (Filtered to Eligible Students)
                    </label>
                    {students.some((s) => s.userId === user.id) && (
                      <button
                        type="button"
                        onClick={() => setTargetUserId(user.id)}
                        className="text-[11px] text-[#D97706] hover:underline font-semibold"
                      >
                        Select Me ({user.name})
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Filter students by name, roll, batch, branch..."
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-1.5 text-xs mb-1.5"
                  />
                  <select
                    required
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                  >
                    <option value={0}>-- Select Target Student --</option>
                    {students.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name} ({s.rollNumber ?? s.batch} · {s.batch} {s.branch ?? ""})
                      </option>
                    ))}
                  </select>
                </div>

                {requestedRole === "MATCH_SCORER" && (
                  <div>
                    <label className="text-xs text-[#D6CFC2] block mb-1">
                      Target Match (Assigns Scorer on Approval)
                    </label>
                    <select
                      value={targetMatchId ?? ""}
                      onChange={(e) => setTargetMatchId(e.target.value)}
                      className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      <option value="">General Match Scorer (Role Only)</option>
                      {availableMatches.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          [{m.status}] {m.sport?.name ?? "Sport"}: {m.teamA?.shortCode ?? "T1"} vs{" "}
                          {m.teamB?.shortCode ?? "T2"} ({m.roundLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {requestedRole !== "MATCH_SCORER" && requestedRole !== "AUCTION_OPERATOR" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#D6CFC2] block mb-1">Sports Club</label>
                      <select
                        value={clubId}
                        onChange={(e) => setClubId(Number(e.target.value))}
                        className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                      >
                        {clubs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {requestedRole === "CLUB_COORDINATOR" && (
                      <>
                        <div>
                          <label className="text-xs text-[#D6CFC2] block mb-1">Batch Scope</label>
                          <select
                            value={batchScope}
                            onChange={(e) => setBatchScope(e.target.value)}
                            className="w-full bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                          >
                            <option value="1ST">1st Year</option>
                            <option value="2ND">2nd Year</option>
                            <option value="3RD">3rd Year</option>
                            <option value="4TH">4th Year</option>
                            <option value="MTECH">MTech</option>
                            <option value="ALL">All Batches</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-[#D6CFC2] block mb-1">
                            Label / Category (Optional)
                          </label>
                          <input
                            type="text"
                            maxLength={40}
                            value={scopeLabel}
                            onChange={(e) => setScopeLabel(e.target.value)}
                            placeholder="e.g., Boys, Girls, Track"
                            className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#D6CFC2] block mb-1">Justification</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for appointment or replacement"
                    className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider"
                >
                  Submit to Approval Queue
                </button>
              </form>
            </section>

            {/* Sports Secretary & PED Admin Controls */}
            <section className="space-y-4">
              {hasGlobalSportsAuthority && <UrgentBannerEditor />}
              {hasGlobalSportsAuthority && (
                <div className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-3">
                  <h2 className="font-editorial text-2xl flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#D97706]" /> Navigation Visibility Controls
                  </h2>
                  <p className="text-xs text-[#8B8680]">
                    Persisted in PostgreSQL site_settings. Auction &amp; Live Auction tabs stay hidden until enabled here.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        toggleNavFlag("showAuctionInNav", !bootstrap?.settings.showAuctionInNav)
                      }
                      className={`px-3 py-2 rounded text-xs font-semibold border ${
                        bootstrap?.settings.showAuctionInNav
                          ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981]"
                          : "bg-[#08080A] border-white/15 text-[#D6CFC2]"
                      }`}
                    >
                      Auction Nav: {bootstrap?.settings.showAuctionInNav ? "VISIBLE" : "HIDDEN"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toggleNavFlag(
                          "showLiveAuctionInNav",
                          !bootstrap?.settings.showLiveAuctionInNav
                        )
                      }
                      className={`px-3 py-2 rounded text-xs font-semibold border ${
                        bootstrap?.settings.showLiveAuctionInNav
                          ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981]"
                          : "bg-[#08080A] border-white/15 text-[#D6CFC2]"
                      }`}
                    >
                      Live Auction Nav:{" "}
                      {bootstrap?.settings.showLiveAuctionInNav ? "VISIBLE" : "HIDDEN"}
                    </button>
                  </div>
                </div>
              )}

              {hasGlobalSportsAuthority && (
                <form
                  onSubmit={handleSemesterRollover}
                  className="rdr-panel rounded-lg p-5 space-y-3 border border-white/15 text-xs"
                >
                  <h2 className="font-editorial text-2xl text-[#F5F2EB]">
                    Controlled Semester Rollover (IIITT)
                  </h2>
                  <p className="text-[#8B8680]">
                    Idempotent per academic term. Advances active students by +1 semester, caps at B.Tech Sem 8 / M.Tech Sem 4 (marking Graduated), and skips Faculty/Staff/Admin.
                  </p>
                  <div className="flex gap-2">
                    <input
                      required
                      value={rolloverTerm}
                      onChange={(e) => setRolloverTerm(e.target.value)}
                      placeholder="e.g., EVEN_2027"
                      className="flex-1 bg-[#08080A] border border-white/15 rounded px-3 py-2 font-mono uppercase"
                    />
                    <button
                      type="submit"
                      disabled={rolloverBusy}
                      className="px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] disabled:opacity-50 font-bold uppercase text-[#F5F2EB]"
                    >
                      {rolloverBusy ? "Rolling..." : "Run Rollover"}
                    </button>
                  </div>
                  {rolloverResult && (
                    <div className="p-2.5 rounded bg-[#08080A] border border-[#10B981]/40 text-[#10B981] font-mono tabular-nums">
                      Term {rolloverResult.term}: {rolloverResult.advancedCount} advanced ·{" "}
                      {rolloverResult.graduatedCount} graduated · {rolloverResult.skippedCount} skipped
                    </div>
                  )}
                </form>
              )}

              {hasRole("FACULTY_ADVISOR") && (
                <div className="rdr-panel rounded-lg p-5 space-y-3 border border-[#D97706]/40">
                  <h2 className="font-editorial text-2xl text-[#D97706]">
                    Faculty Advisor: 1-Click Sports Secretary Handover
                  </h2>
                  <div className="flex gap-2">
                    <select
                      value={handoverUserId}
                      onChange={(e) => setHandoverUserId(Number(e.target.value))}
                      className="flex-1 bg-[#08080A] border border-white/15 rounded px-2.5 py-2 text-xs"
                    >
                      {students.map((s) => (
                        <option key={s.userId} value={s.userId}>
                          {s.name} ({s.rollNumber ?? s.batch})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleHandover}
                      className="px-4 py-2 rounded bg-[#D97706] text-[#08080A] text-xs font-bold uppercase"
                    >
                      Transfer Authority
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Approval Queue */}
          <section className="rdr-panel rounded-lg p-5 space-y-4">
            <h2 className="font-editorial text-2xl flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#10B981]" /> Role Approval Queue
            </h2>
            {requests.length === 0 ? (
              <p className="text-xs text-[#8B8680]">No role requests found.</p>
            ) : (
              <div className="space-y-2.5">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded bg-[#08080A] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#B91C1C]/25 text-[#F5F2EB]">
                          {r.action} {r.requestedRole}
                        </span>
                        <span className="text-sm font-semibold text-[#F5F2EB]">
                          Target: {r.target?.name ?? "Student"}
                        </span>
                        {r.clubName && <span className="text-xs text-[#D97706]">{r.clubName}</span>}
                        {r.batchScope && (
                          <span className="text-xs text-[#8B8680]">
                            ({r.batchScope}{r.scopeLabel ? ` · ${r.scopeLabel}` : ""})
                          </span>
                        )}
                        {r.matchLabel && (
                          <span className="text-xs px-2 py-0.5 rounded bg-[#141418] border border-[#D97706]/40 text-[#F59E0B]">
                            Match: {r.matchLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#D6CFC2] mt-1">
                        Requested by {r.requester?.name ?? "Unknown"} • {r.reason}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === "PENDING" &&
                      (hasGlobalSportsAuthority ||
                        (r.requestedRole === "CLUB_COORDINATOR" &&
                          r.clubId !== null &&
                          Boolean(
                            user?.roles.some(
                              (ur) => ur.roleCode === "CLUB_SECRETARY" && ur.clubId === r.clubId
                            )
                          ))) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => reviewRequest(r.id, "REJECTED")}
                            className="px-3 py-1 rounded bg-white/10 text-xs"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewRequest(r.id, "APPROVED")}
                            className="px-3 py-1 rounded bg-[#10B981] text-[#08080A] text-xs font-bold uppercase"
                          >
                            Approve
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-mono text-[#D97706]">{r.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Role Holders (Direct Revoke for Sports Secretary / Faculty Advisor) */}
          {hasGlobalSportsAuthority && (
            <section className="rdr-panel rounded-lg p-5 space-y-3">
              <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#D97706]" /> Active Role Holders ({holders.length})
              </h2>
              {holders.length === 0 ? (
                <p className="text-xs text-[#8B8680]">No active delegated role holders found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {holders.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded bg-[#08080A] border border-white/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#F5F2EB] truncate">
                          {h.userName}{" "}
                          <span className="font-mono text-[10px] text-[#8B8680]">
                            ({h.rollNumber ?? h.batch})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#D97706] truncate">
                          {h.roleCode}
                          {h.clubName ? ` · ${h.clubName}` : ""}
                          {h.batchScope ? ` · ${h.batchScope}` : ""}
                          {h.scopeLabel ? ` (${h.scopeLabel})` : ""}
                          {h.matchId ? ` · Match #${h.matchId}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={revokingId === h.id}
                        onClick={() => handleRevokeHolder(h.id)}
                        className="px-2.5 py-1 rounded bg-[#DC2626]/20 hover:bg-[#DC2626]/40 text-[#FCA5A5] font-semibold flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" /> {revokingId === h.id ? "..." : "Revoke"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Audit Logs for Admin */}
          {hasGlobalSportsAuthority && auditLogs.length > 0 && (
            <section className="rdr-panel rounded-lg p-5 space-y-3">
              <h2 className="font-editorial text-2xl text-[#F5F2EB]">Immutable Audit Trail</h2>
              <div className="max-h-64 overflow-y-auto space-y-1.5 text-xs font-mono">
                {auditLogs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-2 rounded bg-[#08080A] border border-white/5">
                    <span>
                      <span className="text-[#D97706]">{l.action}</span> • {l.entityType}#{l.entityId} by{" "}
                      {l.actorName ?? "System"}
                    </span>
                    <span className="text-[#8B8680]">{formatIST(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
