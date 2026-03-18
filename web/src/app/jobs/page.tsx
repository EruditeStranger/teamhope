"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";

const STATUS_OPTIONS: JobStatus[] = ["new", "interested", "applied", "interview", "rejected", "blacklisted"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  const loadJobs = useCallback(async () => {
    let query = supabase
      .from("jobs")
      .select("*")
      .gte("score", filterMinScore)
      .order("score", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    if (searchQuery.trim()) {
      query = query.or(
        `title.ilike.%${searchQuery}%,translated_title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    const { data } = await query.limit(100);
    setJobs(data || []);
    setLoading(false);
  }, [filterStatus, filterMinScore, searchQuery]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  async function updateStatus(jobId: number, newStatus: JobStatus) {
    await supabase
      .from("jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
  }

  async function setFeedback(jobId: number, feedback: "up" | "down" | null) {
    await supabase
      .from("jobs")
      .update({ feedback })
      .eq("id", jobId);
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, feedback } : j))
    );
  }

  const scoreColor = (score: number) =>
    score >= 8
      ? "bg-accent-soft text-accent"
      : score >= 5
        ? "bg-caution-soft text-caution"
        : "bg-calm-soft text-calm";

  return (
    <div className="animate-fade-up">
      <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Leads</h2>
      <p className="text-sm text-muted font-light mb-10">求人一覧 — Browse and filter all listings</p>

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
              <div
                key={job.id}
                className="bg-white border border-border rounded-lg p-4 card-hover"
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${scoreColor(job.score)}`}>
                    {job.score}/10
                  </span>

                  <div className="flex-1 min-w-0">
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-normal hover:text-calm transition-colors block truncate"
                    >
                      {job.translated_title || job.title}
                    </a>
                    <span className="text-xs text-muted font-light block truncate mt-0.5">
                      {job.title}
                    </span>
                    {job.score_rationale && (
                      <p className="text-xs text-ink/60 font-light mt-1 italic">
                        {job.score_rationale}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <select
                        value={job.status}
                        onChange={(e) => updateStatus(job.id, e.target.value as JobStatus)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border bg-white cursor-pointer font-light focus:outline-none focus:border-calm"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-muted shrink-0">{job.source}</span>
                      <span className="text-[10px] text-muted font-light shrink-0">
                        {new Date(job.seen_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => setFeedback(job.id, job.feedback === "up" ? null : "up")}
                          className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                            job.feedback === "up"
                              ? "bg-calm-soft text-calm"
                              : "text-muted hover:text-calm"
                          }`}
                          title="Good fit"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => setFeedback(job.id, job.feedback === "down" ? null : "down")}
                          className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                            job.feedback === "down"
                              ? "bg-accent-soft text-accent"
                              : "text-muted hover:text-accent"
                          }`}
                          title="Not a fit"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
