"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/types";

const STATUS_OPTIONS: JobStatus[] = ["new", "interested", "applied", "interview", "rejected", "blacklisted"];

const NOTE_PLACEHOLDERS = {
  up: "What looked good? / どこが良さそうでしたか？",
  down: "What didn't fit? / なぜ合わないと思いましたか？",
};

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-border/40 text-muted line-through">
        Closed
      </span>
    );
  }
  const urgent = daysLeft <= 7;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
      urgent ? "bg-accent-soft text-accent animate-pulse" : "bg-caution-soft text-caution"
    }`}>
      {urgent ? `${daysLeft}d left` : `Due ${deadlineDate.toLocaleDateString()}`}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-accent-soft text-accent"
      : score >= 5
        ? "bg-caution-soft text-caution"
        : "bg-calm-soft text-calm";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${color}`}>
      {score}/10
    </span>
  );
}

interface JobCardProps {
  job: Job;
  onUpdate: (updated: Job) => void;
  showStatus?: boolean;
}

export default function JobCard({ job, onUpdate, showStatus = true }: JobCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(job.feedback_note ?? "");

  // Re-sync local state if parent re-fetches
  useEffect(() => {
    setNoteText(job.feedback_note ?? "");
  }, [job.feedback_note]);

  async function updateStatus(newStatus: JobStatus) {
    await supabase
      .from("jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    onUpdate({ ...job, status: newStatus });
  }

  async function setFeedback(feedback: "up" | "down" | null) {
    const updates: Record<string, unknown> = { feedback };
    if (feedback === null) {
      updates.feedback_note = null;
      setNoteText("");
      setNoteOpen(false);
    }
    await supabase.from("jobs").update(updates).eq("id", job.id);
    onUpdate({ ...job, feedback, ...(feedback === null ? { feedback_note: null } : {}) });
  }

  const toggleFeedback = (dir: "up" | "down") => {
    if (job.feedback === dir) {
      setFeedback(null);
    } else {
      setFeedback(dir);
      setNoteOpen(true);
    }
  };

  async function saveFeedbackNote() {
    const trimmed = noteText.trim() || null;
    await supabase.from("jobs").update({ feedback_note: trimmed }).eq("id", job.id);
    onUpdate({ ...job, feedback_note: trimmed });
    setNoteOpen(false);
  }

  function dismissNote() {
    setNoteText(job.feedback_note ?? "");
    setNoteOpen(false);
  }

  const showNoteArea = noteOpen || !!job.feedback_note;

  return (
    <div className="bg-white border border-border rounded-lg p-4 card-hover">
      <div className="flex items-start gap-3">
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
          {job.translated_title && (
            <span className="text-xs text-muted font-light block truncate mt-0.5">{job.title}</span>
          )}
          {job.score_rationale && (
            <p className="text-xs text-ink/60 font-light mt-1 italic truncate">
              {job.score_rationale}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {showStatus && (
              <select
                value={job.status}
                onChange={(e) => updateStatus(e.target.value as JobStatus)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-white cursor-pointer font-light focus:outline-none focus:border-calm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-muted shrink-0">{job.source}</span>
            {job.posted_at && (
              <span className="text-[10px] text-muted font-light shrink-0">
                Posted {new Date(job.posted_at).toLocaleDateString()}
              </span>
            )}
            <DeadlineBadge deadline={job.deadline} />
            <span className="text-[10px] text-muted font-light shrink-0">
              {new Date(job.seen_at).toLocaleDateString()}
            </span>

            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => toggleFeedback("up")}
                className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                  job.feedback === "up" ? "bg-calm-soft text-calm" : "text-muted hover:text-calm"
                }`}
                title="Good fit / 良い"
              >
                👍
              </button>
              <button
                onClick={() => toggleFeedback("down")}
                className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                  job.feedback === "down" ? "bg-accent-soft text-accent" : "text-muted hover:text-accent"
                }`}
                title="Not a fit / 合わない"
              >
                👎
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline feedback note — expands after thumbs, collapses to a preview when saved */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: noteOpen ? "160px" : showNoteArea ? "36px" : "0px" }}
      >
        {noteOpen ? (
          <div className="mt-3 pl-10">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={job.feedback ? NOTE_PLACEHOLDERS[job.feedback] : ""}
              rows={2}
              autoFocus
              className="w-full text-xs font-light border border-border rounded-md px-3 py-2 bg-paper-warm/50 focus:outline-none focus:border-calm resize-none placeholder:text-muted/60"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={saveFeedbackNote}
                className="text-[11px] font-medium px-3 py-1 rounded-full bg-calm-soft text-calm hover:bg-calm hover:text-white transition-colors"
              >
                Save
              </button>
              <button
                onClick={dismissNote}
                className="text-[11px] text-muted hover:text-ink transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        ) : job.feedback_note ? (
          <button
            onClick={() => setNoteOpen(true)}
            className="mt-2 pl-10 text-xs text-muted font-light italic truncate block w-full text-left hover:text-ink transition-colors"
          >
            &ldquo;{job.feedback_note}&rdquo;
          </button>
        ) : null}
      </div>
    </div>
  );
}
