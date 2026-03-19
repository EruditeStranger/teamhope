"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/lib/types";
import JobCard from "@/app/components/JobCard";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12 animate-fade-up delay-1">
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
              <JobCard
                key={job.id}
                job={job}
                onUpdate={(updated) =>
                  setTopJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
                }
                showStatus={false}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
