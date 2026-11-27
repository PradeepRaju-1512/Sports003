import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home, Trophy } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="rdr-panel rdr-border-crimson max-w-lg w-full p-8 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#B91C1C]/20 border border-[#B91C1C]/50 text-[#D97706]">
          <Compass className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-[#D97706]">
            404 — Page Not Found
          </div>
          <h1 className="font-editorial text-4xl text-[#F5F2EB]">
            Off the Scoreboard
          </h1>
          <p className="text-xs text-[#D6CFC2] leading-relaxed">
            The route you requested does not exist or may have moved. Choose a destination below to continue.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="px-4 py-2 bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-semibold uppercase tracking-wider text-[#F5F2EB] inline-flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Link>
          <Link
            to="/tournaments/current"
            className="px-4 py-2 bg-[#161618] hover:bg-white/10 border border-white/15 text-xs font-semibold uppercase tracking-wider text-[#D6CFC2] inline-flex items-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5 text-[#D97706]" /> Current Tournament
          </Link>
        </div>
      </div>
    </div>
  );
}
