import React, { useEffect, useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";
import { validateUrgentBannerWords } from "../../../shared/validation.ts";

export function UrgentBannerEditor() {
  const { bootstrap, hasGlobalSportsAuthority, notifyToast, refreshAll } = useApp();
  const [bannerText, setBannerText] = useState(bootstrap?.urgentBanner?.title ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBannerText(bootstrap?.urgentBanner?.title ?? "");
  }, [bootstrap?.urgentBanner?.title]);

  if (!hasGlobalSportsAuthority) return null;

  const { valid, wordCount } = validateUrgentBannerWords(bannerText);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/urgent-banner", {
        method: "PUT",
        body: JSON.stringify({ title: bannerText.trim() }),
      });
      await refreshAll();
      notifyToast("success", "Top urgent alert banner updated.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/urgent-banner", { method: "DELETE" });
      setBannerText("");
      await refreshAll();
      notifyToast("info", "Top urgent alert banner cleared.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-editorial text-2xl flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#DC2626]" /> Top Urgent Alert Banner
        </h2>
        <span
          className={`text-xs font-mono font-bold ${
            wordCount > 5
              ? "text-[#DC2626]"
              : wordCount > 0
              ? "text-[#10B981]"
              : "text-[#8B8680]"
          }`}
        >
          {wordCount} / 5 words
        </span>
      </div>

      <p className="text-xs text-[#8B8680]">
        Active banner:{" "}
        {bootstrap?.urgentBanner ? (
          <span className="text-[#F5F2EB] font-semibold uppercase tracking-wide">
            {bootstrap.urgentBanner.title}
          </span>
        ) : (
          <span>None active (top bar hidden)</span>
        )}
      </p>

      <form onSubmit={handleSave} className="space-y-2.5">
        <input
          type="text"
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          placeholder="e.g., CRICKET SEMIS LIVE NOW"
          className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs text-[#F5F2EB] uppercase tracking-wider"
        />
        {wordCount > 5 && (
          <div className="text-[11px] text-[#DC2626] font-semibold">
            Maximum 5 words allowed for the top alert banner.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!valid || busy}
            className="px-4 py-1.5 rounded bg-[#C41E22] hover:bg-[#DC2626] disabled:opacity-45 text-xs font-bold uppercase tracking-wider text-[#F5F2EB]"
          >
            {busy ? "Saving..." : "Save Top Banner"}
          </button>
          {bootstrap?.urgentBanner && (
            <button
              type="button"
              disabled={busy}
              onClick={handleClear}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-[#DC2626]/30 disabled:opacity-45 text-xs font-semibold flex items-center gap-1 text-[#D6CFC2]"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Banner
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
