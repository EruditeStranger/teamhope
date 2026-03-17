"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";

const PIPELINE_STAGES: { status: JobStatus; label: string; labelJp: string; borderColor: string }[] = [
  { status: "interested", label: "Interested", labelJp: "興味あり", borderColor: "border-t-caution" },
  { status: "applied", label: "Applied", labelJp: "応募済", borderColor: "border-t-calm" },
  { status: "interview", label: "Interview", labelJp: "面接", borderColor: "border-t-accent" },
];

export default function TrackerPage() {
  const [jobsByStage, setJobsByStage] = useState<Record<string, Job[]>>({});
  const [loading, setLoading] = useState(true);

  async function loadJobs() {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .in("status", ["interested", "applied", "interview"])
      .order("updated_at", { ascending: false });

    const grouped: Record<string, Job[]> = {};
    for (const stage of PIPELINE_STAGES) {
      grouped[stage.status] = (data || []).filter((j) => j.status === stage.status);
    }
    setJobsByStage(grouped);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function moveJob(jobId: number, newStatus: JobStatus) {
    await supabase
      .from("jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    loadJobs();
  }

  if (loading) return <div className="text-muted font-light">Loading...</div>;

  return (
    <div className="animate-fade-up">
      <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Pipeline</h2>
      <p className="text-sm text-muted font-light mb-10">進捗管理 — Track your application journey</p>

      <div className="grid grid-cols-3 gap-6 animate-fade-up delay-1">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.status}>
            <div className={`border-t-[3px] ${stage.borderColor} bg-white border border-border rounded-lg`}>
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-serif text-xl font-light">
                  {stage.label}
                </h3>
                <span className="text-xs text-muted font-light">{stage.labelJp} — {jobsByStage[stage.status]?.length || 0} jobs</span>
              </div>

              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {(jobsByStage[stage.status] || []).length === 0 ? (
                  <p className="text-xs text-muted font-light text-center py-6">Empty</p>
                ) : (
                  (jobsByStage[stage.status] || []).map((job) => (
                    <div
                      key={job.id}
                      className="p-3 rounded-lg bg-paper border border-border card-hover"
                    >
                      <a
                        href={job.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-normal hover:text-calm transition-colors block truncate"
                      >
                        {job.translated_title || job.title}
                      </a>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted font-light">{job.score}/10</span>
                        <div className="flex gap-1">
                          {PIPELINE_STAGES.filter((s) => s.status !== stage.status).map((s) => (
                            <button
                              key={s.status}
                              onClick={() => moveJob(job.id, s.status)}
                              className="text-[10px] px-2.5 py-1 rounded-full border border-border bg-white hover:bg-paper-warm transition-colors font-light"
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
