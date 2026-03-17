# Project: Asago-to-the-Moon 🚀

A career transition toolkit built by her boyfriend (engineer) to help Sumika Moriwaki pivot from Japanese local administration to the globalized "Japan B" market — and to feel less alone while doing it.

---

## 1. Mission

Stop "plowing a rice field with a Ferrari." Move the search to highways — organizations that value an M.A. from Boston University and 6.5 years of international crisis management experience.

## 2. Candidate Profile: Sumika Moriwaki

- **Academic:** M.A. International Relations, Boston University (Pardee School, 2025); B.A. Intercultural Studies, Yamaguchi Prefectural University
- **Experience:** 6.5 years as International Exchange Program Coordinator at Himeji Cultural and International Exchange Foundation
- **Highlights:** 4-country Duty of Care (Belgium, Australia, South Korea, Singapore), 11-country program portfolio, 1,000+ annual participants, 50+ volunteer network, 7-language newsletter, sister-city diplomacy
- **Certifications:** Johns Hopkins International Travel Safety, TESOL, Japanese Language Teacher, Tea Ceremony Instructor, Goodwill Guide
- **Languages:** Japanese (native), English (advanced)
- **Location:** Hyogo Prefecture (Asago/Ikuno), Japan

## 3. Architecture Decisions

### Delivery layers (decided 2026-03-16)

| Layer | Tool | Rationale |
|---|---|---|
| Job scraping + scoring | **GitHub Actions** cron → `main.py` | Free, stateless, already working |
| Real-time alerts & hype | **Discord** webhooks | She has notifications on, it's their shared project space |
| Structured job management | **Vercel app** (planned) | Search, filter, track applications, story coaching — things Discord can't do |
| Personal communication | **LINE** (no automation) | Keep their intimate channel free of bots |

### Why not LINE for notifications?
LINE Notify shut down March 2025. LINE Messaging API requires a business account (feels impersonal). She already gets Discord notifications. Don't fix what works.

### Token optimization protocol
- **Opus 4.6:** Planning, architecture decisions, ideation, CLAUDE.md updates
- **Sonnet 4.6:** Code execution, file edits, implementation tasks
- Keep CLAUDE.md updated at decision points so either model has full context

## 4. Repository Structure

```
scout/
├── main.py                  # Scraper: JICA PARTNER, Ferrari Score (1-10), Discord alerts + heartbeat + hype
├── requirements.txt         # requests, beautifulsoup4, deep-translator
├── targets.json             # Curated organizations (active scrapers, watch list, future sources, target employers)
├── seen_jobs.json           # Tracked jobs with metadata (auto-generated)
├── CLAUDE.md                # This file — project context for AI agents
├── SKILLS.md                # Reusable skill definitions for implementation
├── .github/workflows/
│   └── scrape.yaml          # Cron: scrape 9AM/9PM JST, hype 3PM JST
├── docs/
│   ├── resume_master.md     # Full resume in markdown (from PDF)
│   ├── stories_bank.md      # 6 STAR narratives (EN + JP)
│   ├── suggestions_from_sumika.md  # Job board sources she suggested
│   ├── Sumika_Moriwaki_BU_Grad_Resume.pdf
│   └── sample_cover_letter.txt
└── prompts/
    ├── tailor_cover_letter.txt   # Cover letter generator prompt
    ├── linkedin_outreach.txt     # Warm intro messages for Kansai recruiters
    └── self_pr.txt               # 自己PR generator with anti-self-deprecation guardrails
```

## 5. Discord Setup ("Asago-to-the-Moon" server)

| Channel | Webhook secret | Purpose |
|---|---|---|
| `#🚨-scout-alerts` | `DISCORD_WEBHOOK_URL` | Job leads with Ferrari Score + framing angle |
| `#🛠-system-status` | `HEARTBEAT_WEBHOOK_URL` | Scraper heartbeat after each run |
| `#📍-the-north-star` | `HYPE_WEBHOOK_URL` | Daily motivational messages (3 PM JST) |
| `#📝-resume-lab` | — | Manual: iterate on CV versions |

All three secrets can point to the same webhook during development.

## 6. Scraper (`main.py`)

- **Active source:** JICA PARTNER (`https://partner.jica.go.jp/Recruit/Search`) only
  - JETRO removed (timeouts + no active openings)
  - Hyogo International Association removed (no jobs section)
  - JICA Careers removed (portal only, not scrapable)
- **Two-pass approach:**
  - Pass 1: Collect job detail links via `a[href*='/Recruit/Detail/']` across paginated search results; extract card-level title (truncated/cleaned at metadata boundaries)
  - Pass 2: Fetch each detail page and score against the full page text
- **Scoring:** Keyword matching against detail page text only (not card text); normalized to 1-10 Ferrari Score with a threshold of 30 (raw score 30+ = 10) — high threshold accounts for JICA being an international cooperation board where generic keywords appear everywhere
- **Translation:** Jobs scoring 5+ are translated via `deep-translator` (Google Translate) for Discord alerts and heartbeat top leads
- **Modes:**
  - `--seed`: First-run mode — tracks all current jobs without sending alerts (baseline)
  - `--hype`: Sends a motivational message to `#📍-the-north-star` drawn from her real accomplishments
- **Alerts:** Discord embeds with Ferrari Score, translated title/snippet, and contextual "Framing Angle"

## 7. Vercel App Architecture

### Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database:** Supabase Postgres (project: `sumi-pen`, free tier: 500MB)
- **Auth:** Simple password gate (single-user tool)
- **Deployment:** Vercel (auto-deploys on push)

### Data flow
```
GitHub Actions (cron) → main.py scrapes → writes directly to Supabase Postgres (via supabase-py)
                                              ↓
                                     Supabase Postgres (sumi-pen)
                                              ↓
                              Next.js App (Vercel) reads + Sumika interacts
```

### Pages
| Route | Purpose |
|---|---|
| `/` | Dashboard: latest leads sorted by Ferrari Score, quick stats |
| `/jobs` | Full job list with filters (score, source, status, date) |
| `/tracker` | Application pipeline: interested → applied → interview → result |
| `/orgs` | Organization management: radar, blacklist, notes |
| `/stories` | STAR coaching tool (sourced from stories_bank.md) |
| `/hype` | Motivational content on demand |
| `/generate` | Cover letter / Self-PR generator (uses prompts/ + LLM API) |

### Key design decisions
- **Vercel Postgres over KV:** Need relational queries (filter jobs by score AND status AND source). KV is key-value only.
- **Scraper writes directly to Supabase:** Using `supabase-py`, the scraper upserts jobs into Postgres. No intermediary API route needed — Supabase's service_role key handles auth.
- **No SSR for data pages:** Use client-side fetching for dashboard/jobs so the page stays interactive. SSR for static content (stories, hype).
- **Bilingual UI:** All labels in both EN and JP since Sumika reads both but thinks in Japanese.

### Database schema (Vercel Postgres)
```sql
jobs (id, title, link, description, source, score, status, seen_at, translated_title)
     status: 'new' | 'interested' | 'applied' | 'interview' | 'rejected' | 'blacklisted'

orgs (id, name, url, category, notes)
     category: 'radar' | 'interested' | 'applied' | 'blacklisted'
```

## 8. Content Pipeline

- `docs/resume_master.md` — canonical resume, populated from actual PDF
- `docs/stories_bank.md` — 6 STAR narratives (EN + JP): Singapore crisis, Himeji diplomacy, pandemic pivot, 7-language newsletter, 1,000-person festival, elementary global awareness
- `docs/suggestions_from_sumika.md` — job board sources she suggested
- `prompts/tailor_cover_letter.txt` — cover letter generator
- `prompts/linkedin_outreach.txt` — warm intro messages for Kansai recruiters (EN + JP)
- `prompts/self_pr.txt` — 自己PR statement generator with anti-self-deprecation guardrails
- Target orgs: Sysmex, P&G Japan (Kobe), Nestlé Japan (Kobe), AstraZeneca Osaka, JICA, JETRO, Hyogo Intl Association, international NGOs in Kansai

## 9. Empathy Guideline

All generated content must emphasize her immense responsibility (4-country safety oversight, 1,000+ participant programs, diplomatic liaison work). Combat the "unemployable" / "overqualified" mindset. She is underdeployed, not underqualified. The right organizations will see that.

## 10. Next Steps (as of 2026-03-16)

### Immediate: Vercel app
1. Scaffold Next.js app in the repo (App Router + Tailwind)
2. Set up Vercel Postgres and define schema
3. Build API route `/api/jobs` for scraper ingestion
4. Modify `main.py` to POST to Vercel API route (in addition to Discord)
5. Build pages: dashboard → jobs list → tracker → orgs
6. Add simple password auth
7. Deploy and test end-to-end

### After Vercel MVP:
- Add scrapers for Sumika's suggested sources: CareerCross, WOHL Career, Activo
- Story coaching page (`/stories`)
- Cover letter / Self-PR generator page (`/generate`) — requires Claude API key
- Hype page (`/hype`)
- Refine Ferrari Score weights based on which jobs she marks "interested"
