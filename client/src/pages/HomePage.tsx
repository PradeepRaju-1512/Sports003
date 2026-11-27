import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, History, Users } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";
import { UrgentBannerEditor } from "../components/UrgentBannerEditor.tsx";

interface ClubCard {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  bannerUrl: string;
  practiceSchedule: string | null;
  inductionOpen: boolean;
  sportName: string;
  category: string;
  inductedCount: number;
  upcomingActivitiesCount: number;
}

export function HomePage() {
  const { bootstrap, hasGlobalSportsAuthority, notifyToast, refreshAll } = useApp();
  const [outdoorClubs, setOutdoorClubs] = useState<ClubCard[]>([]);
  const [indoorClubs, setIndoorClubs] = useState<ClubCard[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [notifyEveryone, setNotifyEveryone] = useState(false);

  const loadClubs = useCallback(() => {
    setClubsLoading(true);
    setClubsError(null);
    apiFetch<{ outdoorClubs: ClubCard[]; indoorClubs: ClubCard[] }>("/api/clubs")
      .then((res) => {
        setOutdoorClubs(res.outdoorClubs);
        setIndoorClubs(res.indoorClubs);
      })
      .catch((err) => {
        const msg = (err as Error).message || "Failed to load clubs.";
        setClubsError(msg);
        notifyToast("error", msg);
      })
      .finally(() => setClubsLoading(false));
  }, [notifyToast]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  useEffect(() => {
    if (!showNoticeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNoticeModal(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showNoticeModal]);

  const wordCount = noticeTitle.trim().split(/\s+/).filter(Boolean).length;

  const publishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: noticeTitle,
          body: noticeBody || noticeTitle,
          isUrgentBanner: isUrgent,
          notifyEveryone,
        }),
      });
      setShowNoticeModal(false);
      setNoticeTitle("");
      setNoticeBody("");
      setIsUrgent(false);
      await refreshAll();
      notifyToast("success", "Notice published.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  const inferNoticeTag = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("trial") || t.includes("induction")) return "TRIAL";
    if (t.includes("tournament") || t.includes("prothymos") || t.includes("premier")) return "TOURNAMENT";
    return "GENERAL";
  };

  const renderClubSection = (sectionTitle: string, list: ClubCard[]) => (
    <section className="rdr-panel p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="rdr-section-title">{sectionTitle}</h2>
        <span className="text-[10px] font-mono tracking-[0.18em] text-[#8B8680] uppercase">
          {list.length} CLUBS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.slug}`}
            className="group bg-[#101012] border border-white/10 hover:border-[#D97706]/60 transition flex flex-col overflow-hidden"
          >
            <div className="relative h-36 overflow-hidden bg-[#0A0A0C]">
              <img
                src={club.bannerUrl}
                alt={club.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101012] via-[#101012]/25 to-transparent" />
              {club.inductionOpen && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#10B981]/90 text-[#08080A] text-[9px] font-bold uppercase tracking-wider">
                  Inductions Open
                </span>
              )}
              <div className="absolute bottom-2.5 left-3 right-3">
                <div className="card-title text-xl font-bold text-[#F5F2EB]">
                  {club.sportName}
                </div>
                <div className="text-[11px] text-[#D97706]">{club.name}</div>
              </div>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
              <p className="text-xs text-[#9B968E] line-clamp-2">{club.tagline}</p>
              <div className="flex items-center justify-between text-[10px] text-[#8B8680] pt-2 border-t border-white/5 uppercase tracking-wider tabular-nums">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#D97706]" /> {club.inductedCount} Inducted
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#DC2626]" /> {club.upcomingActivitiesCount} Upcoming
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="pb-14">
      {/* 1. Full-Bleed Hero Banner with dark vignette & quick action links */}
      <section className="relative h-[430px] sm:h-[520px] w-full overflow-hidden border-b border-[#D97706]/50">
        <img
          src="/images/college.webp"
          alt="IIIT Tiruchirappalli Campus"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/55 to-black/45" />

        <div className="relative z-10 max-w-4xl mx-auto h-full px-6 flex flex-col justify-end pb-10 space-y-3">
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#D97706]">
            CLUBS &bull; TOURNAMENTS &bull; PROTHYMOS &bull; SPORTS ARCHIVE
          </div>
          <h1 className="hero-title text-5xl sm:text-6xl md:text-7xl font-bold text-[#F5F2EB] drop-shadow-xl">
            IIIT TRICHY SPORTS
          </h1>
          <p className="text-xs sm:text-sm text-[#D6CFC2] max-w-2xl">
            Official campus athletics portal for flagship tournaments, club inductions, live match scoring, and Prothymos player auctions.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
            <Link
              to="/tournaments/current"
              className="px-4 py-2 bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-semibold uppercase tracking-wider transition"
            >
              Current Tournament
            </Link>
            <Link
              to={bootstrap?.hasLiveMatches ? "/matches?tab=live" : "/matches?tab=upcoming"}
              className="px-4 py-2 bg-[#141418]/90 hover:bg-[#1C1C22] border border-white/20 text-[#F5F2EB] font-semibold uppercase tracking-wider transition"
            >
              {bootstrap?.hasLiveMatches ? "Live Matches" : "Upcoming Matches"}
            </Link>
            <Link
              to="/clubs"
              className="px-4 py-2 bg-[#141418]/90 hover:bg-[#1C1C22] border border-white/20 text-[#D6CFC2] font-semibold uppercase tracking-wider transition"
            >
              Clubs
            </Link>
            {(bootstrap?.settings.showAuctionInNav || bootstrap?.settings.showLiveAuctionInNav) && (
              <Link
                to={bootstrap?.settings.showLiveAuctionInNav ? "/live-auction" : "/auction"}
                className="px-4 py-2 bg-[#D97706]/20 hover:bg-[#D97706]/30 border border-[#D97706]/60 text-[#F59E0B] font-semibold uppercase tracking-wider transition"
              >
                Prothymos Auction
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. Centered Editorial Column */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Announcements & Notices */}
        <section className="rdr-panel p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="rdr-section-title">Announcements &amp; Notices</h2>
            {hasGlobalSportsAuthority && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBannerEditor((v) => !v)}
                  className="px-2.5 py-1 border border-[#DC2626]/50 bg-[#101012] text-[10px] font-semibold uppercase tracking-wider text-[#FCA5A5] hover:border-[#DC2626]"
                >
                  {showBannerEditor ? "Close Alert Editor" : "Top Alert Banner"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(true)}
                  className="px-2.5 py-1 border border-white/15 bg-[#101012] text-[10px] font-semibold uppercase tracking-wider text-[#D97706] hover:border-[#D97706]"
                >
                  + Post Notice
                </button>
              </div>
            )}
          </div>

          {hasGlobalSportsAuthority && showBannerEditor && <UrgentBannerEditor />}

          <div className="divide-y divide-white/10">
            {(bootstrap?.briefNotices ?? []).length === 0 ? (
              <p className="text-xs text-[#8B8680] py-2">No active notices.</p>
            ) : (
              bootstrap?.briefNotices.map((n) => (
                <div
                  key={n.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#F5F2EB]">{n.title}</div>
                    <div className="text-xs text-[#8B8680] mt-0.5">{n.body}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className="inline-block px-2 py-0.5 bg-[#141418] border border-white/10 text-[10px] tracking-[0.15em] text-[#D97706] uppercase">
                      {inferNoticeTag(n.title)}
                    </span>
                    <div className="text-[10px] font-mono tabular-nums text-[#8B8680]">
                      {formatIST(n.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Distinct On This Day Highlight Card */}
          {bootstrap?.onThisDay && (
            <div className="p-3.5 bg-[#0D0D0F] border border-white/10 border-l-4 border-l-[#D97706] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start sm:items-center gap-2.5 text-[#D6CFC2]">
                <History className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="text-[#D97706] font-bold uppercase tracking-wider mr-1.5">
                    On This Day ({bootstrap.onThisDay.academicYear}):
                  </span>
                  <span className="text-[#F5F2EB] font-medium">
                    {bootstrap.onThisDay.tournamentName}
                  </span>
                  <span className="text-[#8B8680]"> — {bootstrap.onThisDay.scoreSummary}</span>
                </div>
              </div>
              <Link
                to="/archive"
                className="text-[10px] uppercase tracking-[0.15em] text-[#D97706] font-semibold hover:underline shrink-0"
              >
                Explore Archive &rarr;
              </Link>
            </div>
          )}
        </section>

        {/* Outdoor & Team Sports Clubs (5) & Indoor Games Clubs (4) */}
        <div id="clubs" className="space-y-6">
          {clubsLoading ? (
            <div className="rdr-panel p-6 text-xs text-[#8B8680]">Loading official sports clubs...</div>
          ) : clubsError ? (
            <div className="rdr-panel p-6 border border-[#DC2626]/50 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#FCA5A5]">{clubsError}</span>
              <button
                type="button"
                onClick={loadClubs}
                className="px-3 py-1.5 bg-[#B91C1C] text-xs font-bold uppercase text-[#F5F2EB]"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {renderClubSection("Outdoor & Team Sports Clubs", outdoorClubs)}
              {renderClubSection("Indoor Games Clubs", indoorClubs)}
            </>
          )}
        </div>
      </div>

      {/* Notice / <=5-word Banner Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold uppercase tracking-wider text-[#F5F2EB]">
              Publish Campus Notice
            </h3>
            <form onSubmit={publishNotice} className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-[#D97706] font-semibold">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                />
                Set as Top Urgent Alert Banner (Strict 5-word limit)
              </label>
              <div>
                <div className="flex justify-between text-xs text-[#D6CFC2] mb-1">
                  <span>Title / Banner Text</span>
                  {isUrgent && (
                    <span className={wordCount > 5 ? "text-[#DC2626] font-bold" : "text-[#10B981]"}>
                      {wordCount} / 5 words
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder={isUrgent ? "SEMESTER SPORTS TRIALS & CLUB" : "Notice headline"}
                  className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#D6CFC2] block mb-1">Details</label>
                <textarea
                  rows={3}
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="Brief notice details..."
                  className="w-full bg-[#0D0D0F] border border-white/15 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#D6CFC2]">
                <input
                  type="checkbox"
                  checked={notifyEveryone}
                  onChange={(e) => setNotifyEveryone(e.target.checked)}
                />
                Notify everyone via in-app notification bell
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(false)}
                  className="px-3 py-1.5 bg-white/10 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUrgent && (wordCount === 0 || wordCount > 5)}
                  className="px-4 py-1.5 bg-[#B91C1C] hover:bg-[#DC2626] disabled:opacity-40 text-xs font-semibold uppercase"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
