"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Org, OrgCategory } from "@/lib/types";

const CATEGORY_OPTIONS: OrgCategory[] = ["radar", "interested", "applied", "blacklisted"];

const CATEGORY_COLORS: Record<string, string> = {
  radar: "bg-calm-soft text-calm",
  interested: "bg-caution-soft text-caution",
  applied: "bg-calm text-white",
  blacklisted: "bg-accent-soft text-accent",
};

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", url: "", category: "radar" as OrgCategory, notes: "" });

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    const { data } = await supabase
      .from("orgs")
      .select("*")
      .order("created_at", { ascending: false });
    setOrgs(data || []);
    setLoading(false);
  }

  async function addOrg() {
    if (!newOrg.name.trim()) return;
    await supabase.from("orgs").insert(newOrg);
    setNewOrg({ name: "", url: "", category: "radar", notes: "" });
    setShowAdd(false);
    loadOrgs();
  }

  async function updateCategory(orgId: number, category: OrgCategory) {
    await supabase.from("orgs").update({ category }).eq("id", orgId);
    setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, category } : o)));
  }

  async function deleteOrg(orgId: number) {
    await supabase.from("orgs").delete().eq("id", orgId);
    setOrgs((prev) => prev.filter((o) => o.id !== orgId));
  }

  if (loading) return <div className="text-muted font-light">Loading...</div>;

  return (
    <div className="animate-fade-up max-w-3xl">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h2 className="font-serif text-4xl font-light tracking-tight mb-1">Organizations</h2>
          <p className="text-sm text-muted font-light">企業管理 — Companies on your radar</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-5 py-2.5 text-sm bg-ink text-paper rounded-lg hover:bg-ink/80 transition-colors font-light"
        >
          + Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-border rounded-lg p-6 mb-8 animate-fade-up">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Organization name"
              value={newOrg.name}
              onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
              className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
            />
            <input
              type="text"
              placeholder="Website URL"
              value={newOrg.url}
              onChange={(e) => setNewOrg({ ...newOrg, url: e.target.value })}
              className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
            />
            <select
              value={newOrg.category}
              onChange={(e) => setNewOrg({ ...newOrg, category: e.target.value as OrgCategory })}
              className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Notes"
              value={newOrg.notes}
              onChange={(e) => setNewOrg({ ...newOrg, notes: e.target.value })}
              className="px-4 py-3 text-sm font-light border border-border rounded-lg bg-white focus:outline-none focus:border-calm"
            />
          </div>
          <button
            onClick={addOrg}
            className="mt-4 px-5 py-2.5 text-sm bg-ink text-paper rounded-lg hover:bg-ink/80 transition-colors font-light"
          >
            Save
          </button>
        </div>
      )}

      <div className="space-y-2 animate-fade-up delay-1">
        {orgs.length === 0 ? (
          <div className="bg-white border border-border rounded-lg p-8 text-center text-muted font-light">
            No organizations tracked yet.
          </div>
        ) : (
          orgs.map((org) => (
            <div key={org.id} className="bg-white border border-border rounded-lg p-4 flex items-center gap-4 card-hover">
              <div className="flex-1 min-w-0">
                {org.url ? (
                  <a href={org.url} target="_blank" rel="noopener noreferrer" className="text-sm font-normal hover:text-calm transition-colors">
                    {org.name}
                  </a>
                ) : (
                  <span className="text-sm font-normal">{org.name}</span>
                )}
                {org.notes && <p className="text-xs text-muted font-light mt-0.5">{org.notes}</p>}
              </div>

              <select
                value={org.category}
                onChange={(e) => updateCategory(org.id, e.target.value as OrgCategory)}
                className={`text-[10px] px-3 py-1.5 rounded-full border-0 cursor-pointer font-medium uppercase tracking-wider ${CATEGORY_COLORS[org.category]}`}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                onClick={() => deleteOrg(org.id)}
                className="text-xs text-muted hover:text-accent transition-colors font-light"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
