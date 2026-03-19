"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";
import JobCard from "@/app/components/JobCard";

const STATUS_OPTIONS: JobStatus[] = ["new", "interested", "applied", "interview", "rejected", "blacklisted"];

type FeedbackFilter = "all" | "up" | "down" | "none";

const FEEDBACK_TABS: { value: FeedbackFilter; label: string }[] = [
  { value: "all",  label: "All" },
  { value: "up",   label: "👍 Liked" },
  { value: "down", label: "👎 Disliked" },
  { value: "none", label: "Unrated" },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(1);
  const [filterFeedback, setFilterFeedback] = useState<FeedbackFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "deadline" | "posted_at" | "seen_at">("score");

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
      <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Leads</h2>
      <p className="text-sm text-muted font-light mb-10">求人一覧 — Browse and filter all listings</p>

      {/* Feedback tabs */}
      <div className="flex gap-1 mb-6 animate-fade-up delay-1">
        {FEEDBACK_TABS.map((tab) => (
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
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
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
            min={1}
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
              <JobCard key={job.id} job={job} onUpdate={updateJob} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
