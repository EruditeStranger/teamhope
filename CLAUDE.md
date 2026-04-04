# Project: Asago-to-the-Moon 🚀

A career transition toolkit built by her boyfriend (engineer) to help Sumika Moriwaki pivot from Japanese local administration to the globalized "Japan B" market — and to feel less alone while doing it.

---

## 1. Mission

Stop "plowing a rice field with a Ferrari." Move the search to highways — organizations that value an M.A. from Boston University and 6.5 years of international crisis management experience.

## 2. Candidate Profile: Sumika Moriwaki

- **Academic:** M.A. International Relations, Boston University (Pardee School, 2025); B.A. Intercultural Studies, Yamaguchi Prefectural University
- **Experience:** 6.5 years as International Exchange Program Coordinator at Himeji Cultural and International Exchange Foundation
- **Highlights:** 4-country Duty of Care (Belgium, Australia, South Korea, Singapore), 11-country program portfolio, 1,000+ annual participants, 50+ volunteer network, 7-language newsletter, sister-city diplomacy
- **Certifications:** Johns Hopkins International Travel Safety, TESOL, TEC, Children's English Instructor, Japanese Language Teacher, Plain Japanese Usages, Tea Ceremony Instructor & Advisor, Green Tea Instructor, Japanese Tea Selector, Kimono Dresser Instructor, Kimono Meister, RYT 200 (Yoga), Goodwill Guide
- **Honors:** Interlocal Human Resource
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

### Model & reasoning protocol
| Task | Model | Reasoning effort |
|---|---|---|
| Planning, architecture, ideation, CLAUDE.md updates | **Opus 4.6** (`claude-opus-4-6`) | medium |
| Code execution, file edits, implementation | **Sonnet 4.6** (`claude-sonnet-4-6`) | medium |
| Reading large text blobs (scraper output, logs, big files) | **Haiku 4.5** (`claude-haiku-4-5-20251001`) | none needed |

- Keep CLAUDE.md updated at decision points so either model has full context
- **Autonomous model switching:** The Agent tool supports a `model` parameter (`"opus"`, `"sonnet"`, `"haiku"`). A Sonnet agent can and should spawn an Opus subagent for planning tasks, or a Haiku subagent for large text reads — no user instruction needed. Use this for discrete, self-contained tasks (planning phase → Opus subagent returns plan → Sonnet executes).

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
jobs (id, title, link, description, source, score, score_rationale, status, seen_at, translated_title, feedback, feedback_note, updated_at)
     status: 'new' | 'interested' | 'applied' | 'interview' | 'rejected' | 'blacklisted'
     feedback: 'up' | 'down' | null
     feedback_note: text | null  -- optional reason, included in LLM scoring prompt

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

## 10. Next Steps (as of 2026-04-04)

### Completed:
- ✅ Vercel app deployed (Supabase Postgres, ClarityMirror design, responsive/mobile)
- ✅ Pages: Dashboard, Leads, Pipeline, Organizations, Stories (bilingual), North Star
- ✅ Hybrid scoring: keyword prefilter → Claude Haiku LLM scoring with rationale
- ✅ Feedback mechanism: thumbs up/down with optional Japanese note → feeds into LLM scoring prompt
- ✅ Only jobs scoring 5+ saved to Supabase
- ✅ Password auth gate on Vercel app
- ✅ Status dropdown: "—" (new) / Interested / Applied / Interview / Rejected / 見送り
- ✅ Bilingual UI toggle (EN/JP) on Leads page
- ✅ Posting date + deadline badges on JobCard
- ✅ Scraper runs daily at 9:35 AM JST
- ✅ Liked/Disliked counts on feedback tabs

### Feature Roadmap (ordered by complexity / decided 2026-04-04):

| # | Feature | Complexity | Status |
|---|---------|-----------|--------|
| 1 | **"New" tab in Leads** | Low | 🔲 |
| 2 | **Translate AI rationale → JP** | Low-Med | 🔲 |
| 3 | **Weekly Recommendation Ranking** | Medium | 🔲 |
| 4 | **Salary extraction** | Medium | 🔲 |
| 5 | **Remote + commuting distance filter** | Med-High | 🔲 |
| 6 | **Part-time jobs filter/tab** | Med-High | 🔲 |
| 7 | **International jobs section** | High | 🔲 |

### Feature Details:

**Feature 1 — "New" tab in Leads**
- Add "New" as first/default tab on /jobs page, filtering `status = "new"`
- "New" should be default view when opening /jobs
- Changing a job's status away from "—" removes it from this tab naturally (no explicit "mark seen" needed)

**Feature 2 — Translate AI rationale to JP**
- Add `score_rationale_jp` column to `jobs` table in Supabase
- Translate at scrape time using existing `deep-translator` (Google Translate)
- Only translate new jobs going forward (no backfill)
- In JP mode on Leads, show `score_rationale_jp` instead of `score_rationale`
- Add `score_rationale_jp` to `Job` TypeScript interface

**Feature 3 — Weekly Recommendation Ranking**
- Lives on Dashboard (/) and possibly a dedicated section on /jobs
- Logic: top 5 unreviewed (`status = "new"`) jobs by score among those scraped in the past 7 days
- Label: "今週のおすすめ" / "This Week's Picks"
- Resets naturally as new scrapes come in and jobs get reviewed
- No new DB columns needed — purely frontend query logic

**Feature 4 — Salary extraction**
- Add `salary_raw` (text) column to `jobs` table
- Scraper parses salary string from detail page (Japanese formats: 月給, 年収, 時給, etc.)
- Normalization: attempt to parse to monthly yen if format is recognizable; fall back to raw string display
- Show as badge in JobCard metadata row; hide entirely if null
- JICA Volunteer allowance info (生活費給付金 etc.) counts as salary equivalent

**Feature 5 — Remote + commuting distance filter**
- Add `is_remote` (boolean) and `location_raw` (text) columns to `jobs` table
- Scraper detects remote keywords: テレワーク, リモート, 在宅勤務, remote
- Bantan-sen commutable = job location mentions: Himeji, 姫路, Asago, 朝来, Ikuno, 生野, Fukusaki, 福崎, or any Bantan-sen station name
- Himeji walking-distance jobs count as commutable
- Kobe/Osaka excluded from commutable filter (too far)
- Frontend: add "Remote / 在宅" and "Commutable / 通勤圏" filter options on Leads page

**Feature 6 — Part-time jobs filter/tab**
- Add `job_type` column (text: "full-time" | "part-time" | "contract" | "volunteer" | "unknown")
- Scraper detects: パート, アルバイト, 非常勤, 業務委託 → "part-time"; ボランティア → "volunteer"
- Add tab on Leads page: "Part-time / パート"
- Same LLM scoring criteria for now (revisit later)
- New scrapers to add: Mama Works (mamaworks.jp), Shufu Job (part.shufu-job.jp)

**Feature 7 — International jobs section**
- Add `location_country` column (text, default "Japan")
- New scrapers to add (equal-weighted priority sectors: Community Engagement, Youth Development, Study Abroad Advisory, Humanitarian, DevEx):
  - ReliefWeb (reliefweb.int) — humanitarian sector, structured and scrapable
  - DevEx (devex.com) — international development
  - UN Careers (careers.un.org) — if API available
  - Idealist (idealist.org) — NGO/nonprofit
  - AIESEC job board — youth development / study abroad
  - World Learning / SIT — study abroad advisory
- Sumika is open to relocation abroad, especially if relocation covered
- Scoring profile: same for now, but international jobs should get +weight for "relocation support" / 引越し支援 keywords
- UI: "International / 海外" tab on Leads page

### Backlog (not yet prioritized):
- Cover letter / Self-PR generator page (`/generate`) — uses Claude API
- Refine LLM scoring based on accumulated feedback data
- Rotate Supabase secret key
- Scrapers: WOHL Career, CareerCross, HelloWork, ReWork-S, ReWorker, JICA Volunteer

### Sumika's suggested job boards (to scrape):
| Source | URL | Notes | Priority |
|---|---|---|---|
| Activo | activo.jp | Genre 1 = international | ✅ Active |
| JICA Volunteer | jocv-info.jica.go.jp | JICA volunteer positions | Feature 6 |
| Mama Works | mamaworks.jp | Flexible/part-time | Feature 6 |
| Shufu Job | part.shufu-job.jp | Hyogo local listings | Feature 6 |
| ReWork-S | rework-s.com | Remote/flexible work | Backlog |
| ReWorker | reworker.jp | Remote/flexible work | Backlog |
| WOHL Career | worholicareer-recruit.com | Working holiday / bilingual | Backlog |
| CareerCross | careercross.com | Bilingual job board | Backlog |
| HelloWork | hellowork.mhlw.go.jp | Government job search | Backlog |
| 転職サイトまとめ | xn--pckua2a7gp15o89zb.com | Aggregator | Backlog |
