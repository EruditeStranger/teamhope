export type JobStatus =
  | "new"
  | "interested"
  | "applied"
  | "interview"
  | "rejected"
  | "blacklisted";

export type OrgCategory =
  | "radar"
  | "interested"
  | "applied"
  | "blacklisted";

export interface Job {
  id: number;
  title: string;
  link: string;
  description: string;
  source: string;
  score: number;
  score_rationale: string;
  feedback: "up" | "down" | null;
  feedback_note: string | null;
  status: JobStatus;
  translated_title: string;
  seen_at: string;
  updated_at: string;
  posted_at: string | null;
  deadline: string | null;
}

export interface Org {
  id: number;
  name: string;
  url: string;
  category: OrgCategory;
  notes: string;
  created_at: string;
}
