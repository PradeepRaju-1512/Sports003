import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Download, Printer, UploadCloud, Users } from "lucide-react";
import type {
  HydratedAuctionPlayer,
  HydratedFranchise,
} from "../hooks/useAuctionSync.ts";

interface FinalRosterViewProps {
  auctionName: string;
  seasonYear: number;
  status: string;
  sportName: string;
  franchises: HydratedFranchise[];
  unsoldPlayers: HydratedAuctionPlayer[];
  canPublishToTournament?: boolean;
  onPublishToTournament?: () => void;
  publishingToTournament?: boolean;
  publishedTournamentName?: string | null;
}

export function FinalRosterView({
  auctionName,
  seasonYear,
  status,
  sportName,
  franchises,
  unsoldPlayers,
  canPublishToTournament = false,
  onPublishToTournament,
  publishingToTournament = false,
  publishedTournamentName = null,
}: FinalRosterViewProps) {
  const handleExportCsv = () => {
    const rows: string[][] = [
      ["Franchise", "Code", "Captain", "Player", "Batch", "Branch", "Positions", "Class", "Sold Price", "Status"],
    ];
    for (const f of franchises) {
      for (const p of f.boughtPlayers) {
        rows.push([
          f.name,
          f.shortCode,
          f.captain?.name ?? "TBD",
          p.name,
          p.batch,
          p.branch ?? "IIITT",
          p.positions.join(" / "),
          p.playerClass,
          String(p.soldPrice),
          "SOLD",
        ]);
      }
    }
    for (const u of unsoldPlayers) {
      rows.push([
        "UNSOLD",
        "-",
        "-",
        u.displayName,
        u.batch,
        u.branch ?? "IIITT",
        u.positionsJson.join(" / "),
        u.playerClass,
        String(u.basePrice),
        "UNSOLD",
      ]);
    }
    const sanitizeCsvCell = (val: unknown) => {
      const str = String(val ?? "");
      const escaped = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${escaped.replace(/"/g, '""')}"`;
    };
    const csv = rows
      .map((r) => r.map(sanitizeCsvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prothymos-${seasonYear}-${sportName.toLowerCase().replace(/\s+/g, "-")}-final-rosters.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="rdr-panel rdr-border-crimson rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#10B981] font-bold flex items-center gap-1.5">
            <Award className="w-4 h-4" /> Final Franchise Squad Sheets ({status})
          </div>
          <h2 className="font-editorial text-3xl text-[#F5F2EB] mt-0.5">
            {sportName} Final Rosters — {auctionName}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs print:hidden">
          {canPublishToTournament && onPublishToTournament && (
            <button
              type="button"
              disabled={publishingToTournament}
              onClick={onPublishToTournament}
              className="px-3.5 py-2 rounded bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#08080A] font-bold uppercase flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {publishingToTournament ? "Syncing Rosters..." : "Publish Rosters to Current Tournament"}
            </button>
          )}
          <Link
            to="/tournaments/current"
            className="px-3.5 py-2 rounded bg-[#141418] border border-[#10B981]/50 hover:border-[#10B981] text-[#10B981] font-bold uppercase flex items-center gap-1.5"
          >
            Schedule Matches <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 hover:border-[#F59E0B] text-[#F59E0B] font-bold uppercase flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print Sheet
          </button>
        </div>
      </div>

      {publishedTournamentName && (
        <div className="p-4 rounded-lg bg-[#10B981]/15 border border-[#10B981]/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[#F5F2EB]">
            Final {sportName} franchise rosters synced to <strong className="text-[#10B981]">{publishedTournamentName}</strong>!
          </div>
          <Link
            to="/tournaments/current"
            className="px-3.5 py-1.5 rounded bg-[#10B981] text-[#08080A] font-bold uppercase flex items-center gap-1"
          >
            Schedule Matches <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {franchises.length === 0 ? (
        <div className="rdr-panel rounded-lg p-6 text-xs text-[#8B8680]">
          No franchises configured for {sportName} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {franchises.map((f) => (
            <div key={f.id} className="rdr-panel rounded-lg overflow-hidden border border-white/10">
              <div className="h-1.5 w-full" style={{ backgroundColor: f.accentColor }} />
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-editorial text-2xl text-[#F5F2EB]">{f.name}</h3>
                      <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[11px] font-bold text-[#F5F2EB]">
                        {f.shortCode}
                      </span>
                    </div>
                    <div className="text-xs text-[#D6CFC2] mt-0.5">
                      Captain: <span className="font-semibold text-[#F5F2EB]">{f.captain?.name ?? "TBD"}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs space-y-0.5">
                    <div className="text-[#10B981] font-bold">
                      Purse Left: ₹{f.remainingPurse.toLocaleString()}
                    </div>
                    <div className="text-[#D6CFC2]">
                      Squad: {f.squadCount}/{f.maxSquad} (CLUB {f.clubCount} · NON_CLUB {f.nonClubCount})
                    </div>
                  </div>
                </div>

                {f.boughtPlayers.length === 0 ? (
                  <p className="text-xs text-[#8B8680] py-2">No players purchased.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#8B8680] border-b border-white/10 uppercase text-[10px]">
                        <tr>
                          <th className="py-1.5 pr-2">Player</th>
                          <th className="py-1.5 px-2">Year / Branch</th>
                          <th className="py-1.5 px-2">Positions</th>
                          <th className="py-1.5 px-2">Class</th>
                          <th className="py-1.5 pl-2 text-right">Sold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {f.boughtPlayers.map((bp) => (
                          <tr key={bp.id}>
                            <td className="py-2 pr-2 font-semibold text-[#F5F2EB]">
                              <Link to={`/players/${bp.playerProfileId}`} className="hover:text-[#D97706]">
                                {bp.name}
                              </Link>
                            </td>
                            <td className="py-2 px-2 text-[#D6CFC2]">
                              {bp.batch} • {bp.branch ?? "IIITT"}
                            </td>
                            <td className="py-2 px-2 text-[#D6CFC2]">{bp.positions.join(", ")}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  bp.playerClass === "CLUB"
                                    ? "bg-[#10B981]/20 text-[#10B981]"
                                    : "bg-[#D97706]/20 text-[#F59E0B]"
                                }`}
                              >
                                {bp.playerClass}
                              </span>
                            </td>
                            <td className="py-2 pl-2 text-right font-mono font-bold text-[#F59E0B]">
                              ₹{bp.soldPrice.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unsold Players List */}
      <div className="rdr-panel rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#DC2626]" /> {sportName} Unsold Players ({unsoldPlayers.length})
          </h3>
        </div>
        {unsoldPlayers.length === 0 ? (
          <p className="text-xs text-[#8B8680]">No unsold players remaining for {sportName}.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unsoldPlayers.map((u) => (
              <Link
                key={u.id}
                to={`/players/${u.playerProfileId}`}
                className="p-3 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/50 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#F5F2EB] truncate">{u.displayName}</div>
                  <div className="text-[11px] text-[#8B8680]">
                    {u.batch} • {u.branch ?? "IIITT"} · {u.positionsJson.join(", ")}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <div className="font-mono text-[#D97706]">Base ₹{u.basePrice}</div>
                  <div className="text-[10px] font-bold text-[#8B8680]">{u.playerClass}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
