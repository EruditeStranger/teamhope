"""
Scout: Career opportunity scraper for Project Asago-to-the-Moon.
Scrapes job boards, scores listings against Sumika's profile, and
posts high-value leads to Discord via webhook.
"""

import requests
from bs4 import BeautifulSoup
import os
import json
import re
import datetime
import random
import time

try:
    from deep_translator import GoogleTranslator
    _TRANSLATOR_AVAILABLE = True
except ImportError:
    _TRANSLATOR_AVAILABLE = False

try:
    from supabase import create_client as _create_supabase_client
    _SUPABASE_AVAILABLE = True
except ImportError:
    _SUPABASE_AVAILABLE = False

try:
    import anthropic as _anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
HEARTBEAT_WEBHOOK_URL = os.getenv("HEARTBEAT_WEBHOOK_URL", WEBHOOK_URL)
HYPE_WEBHOOK_URL = os.getenv("HYPE_WEBHOOK_URL", WEBHOOK_URL)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DB_FILE = "seen_jobs.json"
TARGETS_FILE = "targets.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# ---------------------------------------------------------------------------
# Ferrari Score: keyword weights (higher = more relevant to Sumika's profile)
# ---------------------------------------------------------------------------
KEYWORD_WEIGHTS = {
    # Japanese keywords
    "国際": 3,
    "海外": 3,
    "危機管理": 5,
    "調整": 2,
    "コーディネーター": 4,
    "修士": 4,
    "修士歓迎": 5,
    "運営": 2,
    "外交": 4,
    "交流": 3,
    "姉妹都市": 5,
    "ボランティア": 2,
    "多文化": 4,
    "異文化": 4,
    "英語": 3,
    "通訳": 3,
    "翻訳": 3,
    "プログラム管理": 4,
    "リスク管理": 5,
    "安全管理": 4,
    "渡航": 3,
    "大学院": 4,
    # English keywords
    "international": 3,
    "coordinator": 4,
    "crisis management": 5,
    "risk management": 5,
    "exchange": 3,
    "diplomatic": 4,
    "intercultural": 4,
    "cross-cultural": 4,
    "master": 4,
    "global": 3,
    "bilingual": 3,
    "program manager": 4,
    "operations": 2,
}

MAX_SCORE = 10

_CJK_RANGES = (
    (0x3000, 0x9FFF),   # CJK Unified Ideographs + kana + punctuation
    (0xF900, 0xFAFF),   # CJK Compatibility Ideographs
    (0x20000, 0x2A6DF), # CJK Extension B
)


def _has_japanese(text: str) -> bool:
    """Return True if text contains at least one CJK/kana character."""
    for ch in text:
        cp = ord(ch)
        if any(lo <= cp <= hi for lo, hi in _CJK_RANGES):
            return True
    return False


def translate_text(text: str) -> str:
    """Translate Japanese text to English using deep-translator.

    Returns the translated string, or the original text on any error.
    Only sends a request if the text actually contains CJK characters.
    """
    if not _has_japanese(text):
        return text
    if not _TRANSLATOR_AVAILABLE:
        print("[WARN] deep_translator not installed — skipping translation")
        return text
    try:
        return GoogleTranslator(source="ja", target="en").translate(text) or text
    except Exception as e:
        print(f"[WARN] translate_text failed: {e}")
        return text


def compute_ferrari_score(text: str) -> int:
    """Score a job listing 1-10 based on keyword relevance to Sumika's profile."""
    text_lower = text.lower()
    raw = 0
    for keyword, weight in KEYWORD_WEIGHTS.items():
        if keyword.lower() in text_lower:
            raw += weight
    # Normalize: cap at MAX_SCORE. A raw score of 30+ maps to 10.
    # Threshold is high because JICA listings naturally contain generic
    # international keywords — only Sumika-specific matches should push 8+.
    score = min(MAX_SCORE, max(1, round(raw * MAX_SCORE / 30)))
    return score


CANDIDATE_PROFILE = """Sumika Moriwaki — M.A. International Relations (Boston University, Pardee School, 2025).
B.A. Intercultural Studies. 6.5 years as International Exchange Program Coordinator at Himeji Cultural
and International Exchange Foundation. Key achievements: 4-country Duty of Care (Belgium, Australia,
South Korea, Singapore), 11-country program portfolio, 1,000+ annual participants, 50+ volunteer network,
7-language newsletter, sister-city diplomacy. Certifications: Johns Hopkins International Travel Safety,
TESOL, Japanese Language Teacher. Languages: Japanese (native), English (advanced).
Location: Hyogo Prefecture, Japan. Looking for international program management, global operations,
cross-cultural coordination, or safety/risk management roles. Preferably in Kansai region or remote."""


def score_with_llm(job_title: str, job_text: str, feedback_history: str = "") -> tuple[int, str]:
    """Score a job using Claude Haiku for nuanced relevance assessment.

    Args:
        job_title: The job listing title.
        job_text: Full text from the job detail page.
        feedback_history: Optional string of past thumbs-up/down examples.

    Returns:
        (score, rationale) — score 1-10, rationale is a one-line explanation.
        Falls back to (keyword_score, "") if the API call fails.
    """
    if not _ANTHROPIC_AVAILABLE or not ANTHROPIC_API_KEY:
        print("[WARN] Anthropic not configured — falling back to keyword scoring")
        return compute_ferrari_score(job_text), ""

    prompt = f"""Score this job listing 1-10 for how well it fits the candidate below.
10 = perfect match (role directly uses her skills). 1 = completely irrelevant.

CANDIDATE:
{CANDIDATE_PROFILE}

JOB TITLE: {job_title}

JOB DESCRIPTION (first 2000 chars):
{job_text[:2000]}
"""

    if feedback_history:
        prompt += f"""
FEEDBACK FROM PAST RATINGS (use this to calibrate — she liked some jobs and disliked others):
{feedback_history}
"""

    prompt += """
Respond in EXACTLY this format (nothing else):
SCORE: <number 1-10>
RATIONALE: <one sentence explaining why, referencing specific candidate skills or job requirements>"""

    try:
        client = _anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()

        # Parse response
        score_match = re.search(r"SCORE:\s*(\d+)", text)
        rationale_match = re.search(r"RATIONALE:\s*(.+)", text)

        score = int(score_match.group(1)) if score_match else 5
        score = max(1, min(10, score))
        rationale = rationale_match.group(1).strip() if rationale_match else text[:200]

        return score, rationale

    except Exception as e:
        print(f"[WARN] LLM scoring failed: {e}")
        return compute_ferrari_score(job_text), ""


def fetch_feedback_history() -> str:
    """Fetch recent feedback from Supabase to include in LLM scoring prompt."""
    if not _SUPABASE_AVAILABLE or not SUPABASE_URL or not SUPABASE_KEY:
        return ""
    try:
        sb = _create_supabase_client(SUPABASE_URL, SUPABASE_KEY)

        liked = sb.table("jobs").select("title, translated_title, score").eq("feedback", "up").limit(10).execute()
        disliked = sb.table("jobs").select("title, translated_title, score").eq("feedback", "down").limit(10).execute()

        lines = []
        for job in (liked.data or []):
            name = job.get("translated_title") or job["title"]
            lines.append(f"LIKED: {name} (scored {job['score']})")
        for job in (disliked.data or []):
            name = job.get("translated_title") or job["title"]
            lines.append(f"DISLIKED: {name} (scored {job['score']})")

        return "\n".join(lines) if lines else ""
    except Exception as e:
        print(f"[WARN] fetch_feedback_history failed: {e}")
        return ""


def score_emoji(score: int) -> str:
    if score >= 8:
        return "🔥🔥🔥"
    elif score >= 5:
        return "🔥"
    else:
        return "📍"


# ---------------------------------------------------------------------------
# Scrapers — one per source
#
# TEMPLATE for adding a new scraper:
#
#   def scrape_<source_name>() -> list[dict]:
#       """Scrape <Source Name> job listings.
#
#       Returns a list of dicts with keys:
#           title (str): Job title (Japanese or English)
#           link (str):  Absolute URL to the job detail page
#           description (str): First ~500 chars of detail page text
#           source (str): Source name, e.g. "CareerCross"
#           score (int): Keyword-based Ferrari Score (1-10), pre-LLM
#           detail_text (str): Full detail page text for LLM scoring
#
#       Steps:
#           1. Paginate through search/listing pages
#           2. Collect job links (deduplicate by URL)
#           3. Fetch each detail page
#           4. Compute keyword score via compute_ferrari_score(detail_text)
#           5. Return the list — LLM scoring happens in main() for jobs >= 5
#       """
#       jobs = []
#       # ... your scraping logic here ...
#       return jobs
#
#   Then add to SCRAPERS list: SCRAPERS = [..., scrape_<source_name>]
# ---------------------------------------------------------------------------

def fetch_job_detail(url: str) -> str:
    """Fetch the full text content of a JICA PARTNER job detail page.

    Returns the visible text of the page as a string, or an empty string
    on any network or HTTP error.
    """
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove script/style noise before extracting text
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)
    except requests.RequestException as e:
        print(f"[WARN] fetch_job_detail({url}) failed: {e}")
        return ""


def scrape_jica_partner() -> list[dict]:
    """Scrape JICA PARTNER job listings across all pages (~300 listings).

    Two-pass approach:
      1. Collect all job links and titles from the paginated search results.
      2. Fetch each detail page to get the full description for accurate scoring.
    """
    base_url = "https://partner.jica.go.jp"
    collected = []   # list of (title, href, search_page_description)
    seen_links = set()

    # --- Pass 1: collect links from search pages ---
    for page in range(1, 35):  # Up to ~31 pages, with margin
        url = f"{base_url}/Recruit/Search?page={page}"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            # Job detail links match /Recruit/Detail/{ID}
            cards = soup.select("a[href*='/Recruit/Detail/']")
            if not cards:
                break  # No more results, stop paginating

            for card in cards:
                href = card.get("href", "")
                # Skip non-detail links that happen to contain the substring
                if not re.search(r"/Recruit/Detail/\d+", href):
                    continue
                if not href.startswith("http"):
                    href = base_url + href
                if href in seen_links:
                    continue
                seen_links.add(href)

                title = card.get_text(strip=True)
                if not title:
                    # Try parent element for title text
                    parent = card.find_parent("div")
                    title = parent.get_text(strip=True) if parent else href
                collected.append((title, href, ""))

            print(f"[INFO] JICA page {page}: found {len(cards)} listings")

        except requests.RequestException as e:
            print(f"[WARN] JICA PARTNER page {page} failed: {e}")
            break  # Don't hammer the server if it's down

    total = len(collected)
    print(f"[INFO] JICA PARTNER search pages done: {total} listings collected — fetching detail pages...")

    # --- Pass 2: fetch detail pages and score against detail content only ---
    jobs = []
    for idx, (card_text, href, _snippet) in enumerate(collected, start=1):
        detail_text = fetch_job_detail(href)

        # Extract a clean title from the detail page (first heading or first line)
        # Fall back to first 80 chars of card text
        title = card_text[:80].split("必要言語")[0].split("勤務地")[0].strip()

        keyword_score = compute_ferrari_score(detail_text) if detail_text else 1
        jobs.append({
            "title": title,
            "link": href,
            "description": detail_text[:500] if detail_text else "",
            "source": "JICA PARTNER",
            "score": keyword_score,
            "detail_text": detail_text,
            "score_rationale": "",
        })

        print(f"[INFO] JICA detail pages: {idx}/{total} fetched")
        time.sleep(0.5)  # Be polite to the server

    print(f"[INFO] JICA PARTNER total: {len(jobs)} listings scored")
    return jobs


# Registry of all scrapers
SCRAPERS = [
    scrape_jica_partner,
]


# ---------------------------------------------------------------------------
# Persistence — seen jobs with metadata
# ---------------------------------------------------------------------------

def load_seen_jobs() -> dict:
    """Load seen jobs. Returns dict of link -> metadata."""
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Migration: old format was a flat list of links
            if isinstance(data, list):
                return {link: {"seen_at": "unknown"} for link in data}
            return data
    return {}


def save_seen_jobs(seen: dict):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(seen, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Discord notifications
# ---------------------------------------------------------------------------

def notify_discord(job: dict):
    """Post a scored job alert to Discord."""
    if not WEBHOOK_URL:
        print(f"[DRY RUN] {job['source']} | {job['title']} | Score: {job['score']}")
        return

    score = job["score"]
    emoji = score_emoji(score)
    framing = suggest_framing(job)

    fields = [
        {"name": "Source", "value": job["source"], "inline": True},
        {"name": "Score", "value": f"{'🟢' * min(score, 10)}", "inline": True},
    ]

    if score >= 5:
        english_title = translate_text(job["title"])
        if english_title and english_title != job["title"]:
            fields.append({"name": "English", "value": english_title, "inline": False})

    fields.append({"name": "Framing Angle", "value": framing, "inline": False})

    embed = {
        "embeds": [{
            "title": f"{emoji} Ferrari Score: {score}/10",
            "description": f"**{job['title']}**",
            "url": job["link"],
            "color": 0xFF4500 if score >= 8 else 0xFFA500 if score >= 5 else 0x808080,
            "fields": fields,
            "footer": {"text": f"Scout | {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"},
        }]
    }

    try:
        requests.post(WEBHOOK_URL, json=embed, timeout=10)
    except requests.RequestException as e:
        print(f"[WARN] Discord notify failed: {e}")


def suggest_framing(job: dict) -> str:
    """Suggest how Sumika should frame her experience for this role."""
    text = f"{job['title']} {job.get('description', '')}".lower()

    angles = []
    if any(kw in text for kw in ["危機", "crisis", "risk", "安全", "safety"]):
        angles.append("Lead with 4-country Duty of Care & Johns Hopkins safety cert")
    if any(kw in text for kw in ["国際", "international", "global", "海外"]):
        angles.append("Emphasize 11-country program portfolio & BU M.A.")
    if any(kw in text for kw in ["調整", "coordinator", "コーディネーター", "運営"]):
        angles.append("Highlight 6.5 yrs coordinating 20+ annual programs, 1000+ participants")
    if any(kw in text for kw in ["外交", "diplomatic", "姉妹", "sister"]):
        angles.append("Sister-city diplomacy across multiple continents")
    if any(kw in text for kw in ["ボランティア", "volunteer", "community"]):
        angles.append("50+ volunteer network management & 7-language newsletter")
    if any(kw in text for kw in ["英語", "english", "bilingual", "通訳", "翻訳"]):
        angles.append("Native JP + Advanced EN, TESOL certified")

    if not angles:
        angles.append("Frame as 'International Ops & Cross-Cultural Program Management'")

    return "\n".join(f"• {a}" for a in angles[:3])


def send_heartbeat(stats: dict, top_jobs: list | None = None):
    """Post a system status heartbeat to Discord.

    Args:
        stats:    Run statistics dict (sources, new_jobs, errors, total_tracked).
        top_jobs: Optional list of the highest-scored new job dicts (up to 5).
                  When provided, a "Top Leads" field is appended to the embed.
    """
    webhook = HEARTBEAT_WEBHOOK_URL
    if not webhook:
        print(f"[DRY RUN] Heartbeat: {stats}")
        return

    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    fields = [
        {"name": "Sources Scraped", "value": str(stats.get("sources", 0)), "inline": True},
        {"name": "New Leads", "value": str(stats.get("new_jobs", 0)), "inline": True},
        {"name": "Errors", "value": str(stats.get("errors", 0)), "inline": True},
        {"name": "Total Tracked", "value": str(stats.get("total_tracked", 0)), "inline": True},
    ]

    if top_jobs:
        lines = []
        for job in top_jobs[:5]:
            score = job.get("score", 0)
            english_title = translate_text(job["title"])
            emoji = "🔥" if score >= 5 else "📍"
            lines.append(f"{emoji} {score}/10 — {english_title}")
        fields.append({
            "name": "Top Leads",
            "value": "\n".join(lines),
            "inline": False,
        })

    embed = {
        "embeds": [{
            "title": "💓 Scout Heartbeat",
            "color": 0x00FF00 if stats.get("errors", 0) == 0 else 0xFF0000,
            "fields": fields,
            "footer": {"text": f"Scout | {now}"},
        }]
    }

    try:
        requests.post(webhook, json=embed, timeout=10)
    except requests.RequestException as e:
        print(f"[WARN] Heartbeat failed: {e}")


# ---------------------------------------------------------------------------
# Hype system — motivational messages for #the-north-star
# ---------------------------------------------------------------------------

HYPE_MESSAGES = [
    "**Remember:** You managed international safety logistics across 4 countries. Most people never even get a passport. You're not unemployable — you're *underdeployed*. 🚀",
    "**Fact check:** You have an M.A. from Boston University, 6.5 years of diplomatic experience, and certifications most hiring managers can only dream of listing. The right door hasn't opened yet. That's all. 🔑",
    "**You coordinated programs for 1,000+ people.** That's not 'just admin.' That's operations leadership at scale. Own it. 💪",
    "**They said 'overqualified.'** Translation: *they couldn't afford you.* The highway is where you belong, not the rice field. 🏎️",
    "**11 countries. 7 languages. 50+ volunteers. 20+ annual programs.** Read that again. That's your resume. You built that. ✨",
    "**The Ferrari doesn't belong in a typewriter shop.** Today might feel slow, but you're heading for the highway. 🛣️",
    "**Quick reminder:** Johns Hopkins safety cert + BU M.A. + 6.5 years of real crisis management = a profile most global orgs would fight over. The search is temporary. Your skills are permanent. 🌏",
    "**You facilitated cross-cultural programs during a global pandemic.** When the whole world stopped, you found a way to keep connecting people. That's leadership. 🌟",
    "**Tea ceremony instructor. TESOL certified. Crochet artist.** You're not just qualified — you're interesting. The right team will see that. 🍵",
    "**好香ちゃん、大丈夫。ボストン大学の修士号を持って、4カ国の安全管理をやり遂げた人が「使えない」わけがない。世界はあなたを必要としている。今日も一歩前へ。** 🌸",
]


def send_hype():
    """Post a motivational message to the hype channel."""
    webhook = HYPE_WEBHOOK_URL
    if not webhook:
        print("[DRY RUN] Hype message would be sent")
        return

    message = random.choice(HYPE_MESSAGES)
    embed = {
        "embeds": [{
            "title": "🌟 Gambatte from Sumi-Pen",
            "description": message,
            "color": 0xFFD700,
            "footer": {"text": "You've got this — Project Asago-to-the-Moon 🚀"},
        }]
    }

    try:
        requests.post(webhook, json=embed, timeout=10)
    except requests.RequestException as e:
        print(f"[WARN] Hype message failed: {e}")


# ---------------------------------------------------------------------------
# Supabase sync
# ---------------------------------------------------------------------------

def sync_to_supabase(jobs: list[dict]):
    """Upsert jobs scoring 5+ into Supabase Postgres. Skips if not configured."""
    if not _SUPABASE_AVAILABLE or not SUPABASE_URL or not SUPABASE_KEY:
        print("[INFO] Supabase not configured — skipping DB sync")
        return

    try:
        sb = _create_supabase_client(SUPABASE_URL, SUPABASE_KEY)
        upserted = 0
        skipped = 0
        for job in jobs:
            if job["score"] < 5:
                skipped += 1
                continue

            # Translate title for qualifying jobs
            translated = translate_text(job["title"])

            row = {
                "title": job["title"],
                "link": job["link"],
                "description": job.get("description", "")[:500],
                "source": job["source"],
                "score": job["score"],
                "score_rationale": job.get("score_rationale", ""),
                "translated_title": translated if translated != job["title"] else "",
                "seen_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            # Upsert: insert or update score/description if link already exists
            sb.table("jobs").upsert(row, on_conflict="link").execute()
            upserted += 1

        print(f"[INFO] Supabase sync: {upserted} jobs upserted, {skipped} below threshold (< 5)")
    except Exception as e:
        print(f"[WARN] Supabase sync failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(seed_mode: bool = False):
    seen = load_seen_jobs()
    stats = {"sources": 0, "new_jobs": 0, "errors": 0, "total_tracked": len(seen)}

    all_jobs = []
    for scraper in SCRAPERS:
        stats["sources"] += 1
        try:
            jobs = scraper()
            all_jobs.extend(jobs)
        except Exception as e:
            stats["errors"] += 1
            print(f"[ERROR] {scraper.__name__}: {e}")

    # --- LLM scoring pass: refine jobs that keyword-scored 5+ ---
    feedback_history = fetch_feedback_history()
    llm_candidates = [j for j in all_jobs if j["score"] >= 5]
    if llm_candidates:
        print(f"[INFO] LLM scoring {len(llm_candidates)} jobs (keyword score >= 5)...")
        for idx, job in enumerate(llm_candidates, 1):
            detail = job.get("detail_text", job.get("description", ""))
            llm_score, rationale = score_with_llm(job["title"], detail, feedback_history)
            job["score"] = llm_score
            job["score_rationale"] = rationale
            print(f"[INFO] LLM scored {idx}/{len(llm_candidates)}: {llm_score}/10 — {rationale[:80]}")
    else:
        print("[INFO] No jobs scored 5+ in keyword pass — skipping LLM scoring")

    # Deduplicate, notify new, sort by score (highest first)
    all_jobs.sort(key=lambda j: j["score"], reverse=True)

    new_jobs_list: list[dict] = []
    for job in all_jobs:
        if job["link"] not in seen:
            if not seed_mode:
                notify_discord(job)
            seen[job["link"]] = {
                "title": job["title"],
                "source": job["source"],
                "score": job["score"],
                "seen_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            stats["new_jobs"] += 1
            new_jobs_list.append(job)

    if new_jobs_list:
        stats["total_tracked"] = len(seen)
        save_seen_jobs(seen)

    # Sync ALL scraped jobs to Supabase (upsert updates scores for existing jobs)
    sync_to_supabase(all_jobs)

    # Top 5 new leads (already sorted by score descending)
    top_jobs = new_jobs_list[:5] if new_jobs_list else None

    if seed_mode:
        print(f"[INFO] Seeded {stats['new_jobs']} jobs into tracker (no notifications sent)")
    send_heartbeat(stats, top_jobs=top_jobs)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--hype":
        send_hype()
    elif len(sys.argv) > 1 and sys.argv[1] == "--seed":
        # First run: scrape and track everything WITHOUT sending 300+ Discord alerts
        print("[INFO] Seed mode: tracking all current listings without notifications")
        main(seed_mode=True)
    else:
        main()
