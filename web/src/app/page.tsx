"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/lib/types";
import JobCard from "@/app/components/JobCard";

export default function Dashboard() {
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [weeklyPicks, setWeeklyPicks] = useState<Job[]>([]);
  const [stats, setStats] = useState({ total: 0, new_count: 0, applied: 0, avg_score: 0 });
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "jp">("jp");

  useEffect(() => {
    async function load() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: jobs },
        { data: picks },
        { count: total },
        { count: newCount },
        { count: applied },
        { data: avgData },
      ] = await Promise.all([
        supabase.from("jobs").select("*").order("score", { ascending: false }).limit(10),
        supabase.from("jobs").select("*").gte("seen_at", sevenDaysAgo).gte("score", 7).order("score", { ascending: false }).limit(5),
        supabase.from("jobs").select("*", { count: "exact", head: true }),
        supabase.from("jobs").select("*", { count: "exact", head: true }).gte("seen_at", sevenDaysAgo),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "applied"),
        supabase.from("jobs").select("score"),
      ]);

      const avgScore = avgData && avgData.length > 0
        ? Math.round((avgData.reduce((sum, j) => sum + j.score, 0) / avgData.length) * 10) / 10
        : 0;

      setTopJobs(jobs || []);
      setWeeklyPicks(picks || []);
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
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Dashboard</h2>
          <p className="text-sm text-muted font-light">ダッシュボード — Your search at a glance</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${lang === "en" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"}`}
          >EN</button>
          <button
            onClick={() => setLang("jp")}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${lang === "jp" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"}`}
          >JP</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12 animate-fade-up delay-1">
        {[
          { label: "TOTAL",     labelJp: "合計",   value: stats.total,     color: "border-l-ink/20" },
          { label: "THIS WEEK", labelJp: "今週",   value: stats.new_count, color: "border-l-calm" },
          { label: "APPLIED",   labelJp: "応募済", value: stats.applied,   color: "border-l-caution" },
          { label: "AVG SCORE", labelJp: "平均",   value: stats.avg_score, color: "border-l-accent" },
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

      {/* Weekly Picks */}
      {weeklyPicks.length > 0 && (
        <div className="mb-12 animate-fade-up delay-2">
          <div className="flex items-baseline gap-3 mb-4">
            <div className="label-caps">今週のおすすめ</div>
            <div className="text-xs text-muted font-light">This Week&apos;s Picks — top matches from the last 7 days</div>
          </div>
          <div className="space-y-2">
            {weeklyPicks.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onUpdate={(updated) =>
                  setWeeklyPicks((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
                }
                showStatus={false}
                lang={lang}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top leads */}
      <div className="animate-fade-up delay-3">
        <div className="label-caps mb-4">TOP LEADS</div>
        <div className="space-y-2">
          {topJobs.length === 0 ? (
            <div className="bg-white border border-border rounded-lg p-8 text-center text-muted font-light">
              No jobs yet. Run the scraper to populate data.
            </div>
          ) : (
            topJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onUpdate={(updated) =>
                  setTopJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
                }
                showStatus={false}
                lang={lang}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
