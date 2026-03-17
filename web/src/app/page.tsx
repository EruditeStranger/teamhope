"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/lib/types";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-accent-soft text-accent"
      : score >= 5
        ? "bg-caution-soft text-caution"
        : "bg-calm-soft text-calm";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${color}`}>
      {score}/10
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-calm-soft text-calm",
    interested: "bg-caution-soft text-caution",
    applied: "bg-calm text-white",
    interview: "bg-caution text-white",
    rejected: "bg-ink/5 text-muted",
    blacklisted: "bg-accent-soft text-accent",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${colors[status] || colors.new}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({ total: 0, new_count: 0, applied: 0, avg_score: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("*")
        .order("score", { ascending: false })
        .limit(10);

      const { count: total } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true });

      const { count: newCount } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");

      const { count: applied } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "applied");

      const { data: avgData } = await supabase
        .from("jobs")
        .select("score");

      const avgScore = avgData && avgData.length > 0
        ? Math.round((avgData.reduce((sum, j) => sum + j.score, 0) / avgData.length) * 10) / 10
        : 0;

      setTopJobs(jobs || []);
      setStats({
        total: total || 0,
        new_count: newCount || 0,
        applied: applied || 0,
        avg_score: avgScore,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-muted font-light">Loading...</div>;
  }

  return (
    <div className="animate-fade-up">
      <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Dashboard</h2>
      <p className="text-sm text-muted font-light mb-10">ダッシュボード — Your search at a glance</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-12 animate-fade-up delay-1">
        {[
          { label: "TOTAL", labelJp: "合計", value: stats.total, color: "border-l-ink/20" },
          { label: "NEW", labelJp: "新着", value: stats.new_count, color: "border-l-calm" },
          { label: "APPLIED", labelJp: "応募済", value: stats.applied, color: "border-l-caution" },
          { label: "AVG SCORE", labelJp: "平均", value: stats.avg_score, color: "border-l-accent" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`bg-white border border-border ${stat.color} border-l-[3px] rounded-lg p-5`}
          >
            <div className="label-caps">{stat.label}</div>
            <div className="text-xs text-muted mb-2">{stat.labelJp}</div>
            <div className="font-serif text-3xl font-light">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Top leads */}
      <div className="animate-fade-up delay-2">
        <div className="label-caps mb-4">TOP LEADS</div>
        <div className="space-y-2">
          {topJobs.length === 0 ? (
            <div className="bg-white border border-border rounded-lg p-8 text-center text-muted font-light">
              No jobs yet. Run the scraper to populate data.
            </div>
          ) : (
            topJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-border rounded-lg p-4 flex items-center gap-4 card-hover"
              >
                <ScoreBadge score={job.score} />
                <div className="flex-1 min-w-0">
                  <a
                    href={job.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-normal hover:text-calm transition-colors block truncate"
                  >
                    {job.translated_title || job.title}
                  </a>
                  <p className="text-xs text-muted font-light truncate mt-0.5">{job.title}</p>
                </div>
                <StatusPill status={job.status} />
                <span className="text-[10px] text-muted font-light">{job.source}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
