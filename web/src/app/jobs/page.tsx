"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";
import JobCard from "@/app/components/JobCard";

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "new",        label: "—" },
  { value: "interested", label: "Interested" },
  { value: "applied",    label: "Applied" },
  { value: "interview",  label: "Interview" },
  { value: "rejected",   label: "Rejected" },
  { value: "見送り",      label: "見送り" },
];

type FeedbackFilter = "all" | "up" | "down" | "none";

type Lang = "en" | "jp";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(5);
  const [filterFeedback, setFilterFeedback] = useState<FeedbackFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "deadline" | "posted_at" | "seen_at">("score");
  const [lang, setLang] = useState<Lang>("jp");
  const [feedbackCounts, setFeedbackCounts] = useState<{ up: number; down: number }>({ up: 0, down: 0 });

  useEffect(() => {
    async function loadCounts() {
      const [{ count: up }, { count: down }] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("feedback", "up"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("feedback", "down"),
      ]);
      setFeedbackCounts({ up: up ?? 0, down: down ?? 0 });
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

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
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
  }, [filterStatus, filterMinScore, filterFeedback, searchQuery, sortBy]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function updateJob(updated: Job) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between mb-10">
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

      {/* Feedback tabs */}
      <div className="flex gap-1 mb-6 animate-fade-up delay-1">
        {(
          [
            { value: "all",  label: "All" },
            { value: "up",   label: `👍 Liked${feedbackCounts.up ? ` (${feedbackCounts.up})` : ""}` },
            { value: "down", label: `👎 Disliked${feedbackCounts.down ? ` (${feedbackCounts.down})` : ""}` },
            { value: "none", label: "Unrated" },
          ] as { value: FeedbackFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterFeedback(tab.value)}
            className={`px-4 py-2 text-xs rounded-lg font-light transition-colors ${
              filterFeedback === tab.value
                ? "bg-ink text-paper"
                : "bg-white border border-border text-muted hover:text-ink"
            }`}
          >
            {tab.label}
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
        >
          <option value="all">Status: All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

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
              No jobs match your filters.
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
