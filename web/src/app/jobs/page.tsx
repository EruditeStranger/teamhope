"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";
import JobCard from "@/app/components/JobCard";

type FeedbackFilter = "all" | "up" | "down" | "none";
type ViewTab = "new" | "all" | "active" | "archived";
type WorkFilter = "all" | "remote" | "commutable" | "part-time" | "international";
type Lang = "en" | "jp";

const VIEW_TABS: { value: ViewTab; label: string; jp: string }[] = [
  { value: "new",      label: "New",      jp: "新着" },
  { value: "all",      label: "All",      jp: "すべて" },
  { value: "active",   label: "Active",   jp: "進行中" },
  { value: "archived", label: "Archived", jp: "アーカイブ" },
];

// Which DB statuses each view tab filters to (empty = no status filter)
const VIEW_STATUS_MAP: Record<ViewTab, JobStatus[]> = {
  new:      [],  // filtered by seen_at recency, not status
  all:      [],
  active:   ["interested", "applied", "interview"],
  archived: ["rejected", "見送り"],
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<ViewTab>("new");
  const [filterMinScore, setFilterMinScore] = useState<number>(5);
  const [filterFeedback, setFilterFeedback] = useState<FeedbackFilter>("all");
  const [filterWork, setFilterWork] = useState<WorkFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "deadline" | "posted_at" | "seen_at">("score");
  const [lang, setLang] = useState<Lang>("jp");
  const [counts, setCounts] = useState({ up: 0, down: 0, newJobs: 0 });

  useEffect(() => {
    async function loadCounts() {
      const [{ count: up }, { count: down }, { count: newJobs }] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("feedback", "up"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("feedback", "down"),
        supabase.from("jobs").select("*", { count: "exact", head: true })
          .gte("seen_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      setCounts({ up: up ?? 0, down: down ?? 0, newJobs: newJobs ?? 0 });
    }
    loadCounts();
  }, []);

  const loadJobs = useCallback(async () => {
    const ascending = sortBy === "deadline";
    let query = supabase
      .from("jobs")
      .select("*")
      .gte("score", filterMinScore)
      .order(sortBy, { ascending, nullsFirst: false });

    if (viewTab === "new") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("seen_at", sevenDaysAgo);
    } else {
      const statuses = VIEW_STATUS_MAP[viewTab];
      if (statuses.length === 1) {
        query = query.eq("status", statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in("status", statuses);
      }
    }

    if (filterWork === "remote") {
      query = query.eq("is_remote", true);
    } else if (filterWork === "commutable") {
      query = query.eq("is_bantan_commutable", true);
    } else if (filterWork === "part-time") {
      query = query.eq("job_type", "part-time");
    } else if (filterWork === "international") {
      query = query.not("location_country", "eq", "Japan");
    }

    if (filterFeedback === "up") {
      query = query.eq("feedback", "up");
    } else if (filterFeedback === "down") {
      query = query.eq("feedback", "down");
    } else if (filterFeedback === "none") {
      query = query.is("feedback", null);
    }

    if (searchQuery.trim()) {
      query = query.or(
        `title.ilike.%${searchQuery}%,translated_title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    const { data } = await query.limit(100);
    setJobs(data || []);
    setLoading(false);
  }, [viewTab, filterMinScore, filterFeedback, filterWork, searchQuery, sortBy]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function updateJob(updated: Job) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Leads</h2>
          <p className="text-sm text-muted font-light">求人一覧 — Browse and filter all listings</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${
              lang === "en" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"
            }`}
          >EN</button>
          <button
            onClick={() => setLang("jp")}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${
              lang === "jp" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"
            }`}
          >JP</button>
        </div>
      </div>

      {/* View tabs — primary navigation */}
      <div className="flex gap-1 mb-5 animate-fade-up delay-1">
        {VIEW_TABS.map((tab) => {
          const label = lang === "jp" ? tab.jp : tab.label;
          const badge = tab.value === "new" && counts.newJobs > 0 ? ` (${counts.newJobs})` : "";
          return (
            <button
              key={tab.value}
              onClick={() => setViewTab(tab.value)}
              className={`px-4 py-2 text-sm rounded-lg font-light transition-colors ${
                viewTab === tab.value
                  ? "bg-ink text-paper"
                  : "bg-white border border-border text-muted hover:text-ink"
              }`}
            >
              {label}{badge}
            </button>
          );
        })}
      </div>

      {/* Feedback tabs — secondary filter */}
      <div className="flex gap-1 mb-6 animate-fade-up delay-1">
        {(
          [
            { value: "all",  label: "All" },
            { value: "up",   label: `👍 Liked${counts.up ? ` (${counts.up})` : ""}` },
            { value: "down", label: `👎 Disliked${counts.down ? ` (${counts.down})` : ""}` },
            { value: "none", label: "Unrated" },
          ] as { value: FeedbackFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterFeedback(tab.value)}
            className={`px-4 py-2 text-xs rounded-lg font-light transition-colors ${
              filterFeedback === tab.value
                ? "bg-calm-soft text-calm border border-calm/30"
                : "bg-white border border-border text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Work style filter chips */}
      <div className="flex gap-1 mb-6 animate-fade-up delay-1">
        {(
          [
            { value: "all",           label: "All styles",       jp: "すべて" },
            { value: "remote",        label: "🏠 Remote",        jp: "🏠 リモート" },
            { value: "commutable",    label: "🚃 Bantan-sen",    jp: "🚃 播但線沿線" },
            { value: "part-time",     label: "⏰ Part-time",     jp: "⏰ パート" },
            { value: "international", label: "✈️ International", jp: "✈️ 海外" },
          ] as { value: WorkFilter; label: string; jp: string }[]
        ).map((chip) => (
          <button
            key={chip.value}
            onClick={() => setFilterWork(chip.value)}
            className={`px-4 py-2 text-xs rounded-lg font-light transition-colors ${
              filterWork === chip.value
                ? "bg-caution-soft text-caution border border-caution/30"
                : "bg-white border border-border text-muted hover:text-ink"
            }`}
          >
            {lang === "jp" ? chip.jp : chip.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 animate-fade-up delay-1">
        <input
          type="text"
          placeholder="Search / 検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white w-full md:w-64 focus:outline-none focus:border-calm transition-colors"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
        >
          <option value="score">Sort: Score ↓</option>
          <option value="deadline">Sort: Deadline (soonest)</option>
          <option value="posted_at">Sort: Posted (newest)</option>
          <option value="seen_at">Sort: Seen (newest)</option>
        </select>

        <div className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-2">
          <span className="label-caps">MIN SCORE</span>
          <input
            type="range"
            min={5}
            max={10}
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(Number(e.target.value))}
            className="w-24 accent-calm"
          />
          <span className="text-sm font-medium text-ink w-5">{filterMinScore}</span>
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="text-muted font-light">Loading...</div>
      ) : (
        <div className="space-y-2 animate-fade-up delay-2">
          {jobs.length === 0 ? (
            <div className="bg-white border border-border rounded-lg p-8 text-center text-muted font-light">
              {viewTab === "new"
                ? (lang === "jp" ? "新しい求人はありません。" : "No new jobs — you're all caught up.")
                : (lang === "jp" ? "該当する求人がありません。" : "No jobs match your filters.")}
            </div>
          ) : (
            jobs.map((job) => (
              <JobCard key={job.id} job={job} onUpdate={updateJob} lang={lang} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
