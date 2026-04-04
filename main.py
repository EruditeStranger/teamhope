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



def translate_text(text: str, target: str = "en") -> str:
    """Translate text using deep-translator (Google Translate).

    Returns the translated string, or the original text on any error.
    Only sends a request if the text actually contains CJK characters.
    """
    if not _TRANSLATOR_AVAILABLE:
        print("[WARN] deep_translator not installed — skipping translation")
        return text
    try:
        return GoogleTranslator(source="auto", target=target).translate(text) or text
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
B.A. Intercultural Studies. PREVIOUSLY (March 2018 – August 2024, now departed): International Exchange
Program Coordinator at Himeji Cultural and International Exchange Foundation. She no longer works there
and is actively seeking a new role. Key achievements: 4-country Duty of Care (Belgium, Australia,
South Korea, Singapore), 11-country program portfolio, 1,000+ annual participants, 50+ volunteer network,
7-language newsletter, sister-city diplomacy. Honored as an Interlocal Human Resource.
Certifications: Johns Hopkins International Travel Safety, TESOL, TEC, Children's English Instructor,
Japanese Language Teacher, Plain Japanese Usages, Tea Ceremony Instructor & Advisor, Green Tea Instructor,
Japanese Tea Selector, Kimono Dresser Instructor, Kimono Meister, RYT 200 (Yoga), Goodwill Guide.
Languages: Japanese (native), English (advanced).
Location: Hyogo Prefecture, Japan. Looking for international program management, global operations,
cross-cultural coordination, safety/risk management, education, or cultural programming roles.
Preferably in Kansai region or remote."""


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
FEEDBACK FROM PAST RATINGS (use this to calibrate — she liked some jobs and disliked others).
Reasons may be written in Japanese — interpret them as-is:
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

        liked = sb.table("jobs").select("title, translated_title, score, feedback_note").eq("feedback", "up").limit(10).execute()
        disliked = sb.table("jobs").select("title, translated_title, score, feedback_note").eq("feedback", "down").limit(10).execute()

        lines = []
        for job in (liked.data or []):
            name = job.get("translated_title") or job["title"]
            line = f"LIKED: {name} (scored {job['score']})"
            if job.get("feedback_note"):
                line += f" — reason: {job['feedback_note']}"
            lines.append(line)
        for job in (disliked.data or []):
            name = job.get("translated_title") or job["title"]
            line = f"DISLIKED: {name} (scored {job['score']})"
            if job.get("feedback_note"):
                line += f" — reason: {job['feedback_note']}"
            lines.append(line)

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

def extract_dates_from_json_ld(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """Extract datePosted and validThrough from Schema.org JSON-LD in a page.

    Searches all <script type="application/ld+json"> blocks for the first
    object with @type "JobPosting". Returns (posted_at, deadline) as ISO 8601
    strings, or None for either if not found.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("@type") == "JobPosting":
                posted = item.get("datePosted")
                deadline = item.get("validThrough")
                return (posted or None, deadline or None)
    return (None, None)


def fetch_job_detail(url: str) -> tuple[str, BeautifulSoup | None]:
    """Fetch a job detail page.

    Returns (visible_text, raw_soup) where raw_soup still has script tags
    intact for JSON-LD extraction. Returns ("", None) on any network error.
    """
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        # raw_soup preserves <script> tags for JSON-LD extraction
        raw_soup = BeautifulSoup(resp.text, "html.parser")
        # text_soup has scripts stripped for clean visible text
        text_soup = BeautifulSoup(resp.text, "html.parser")
        for tag in text_soup(["script", "style", "noscript"]):
            tag.decompose()
        return (text_soup.get_text(separator=" ", strip=True), raw_soup)
    except requests.RequestException as e:
        print(f"[WARN] fetch_job_detail({url}) failed: {e}")
        return ("", None)


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
        detail_text, detail_soup = fetch_job_detail(href)
        posted_at, deadline = extract_dates_from_json_ld(detail_soup) if detail_soup else (None, None)

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
            "posted_at": posted_at,
            "deadline": deadline,
        })

        print(f"[INFO] JICA detail pages: {idx}/{total} fetched")
        time.sleep(0.5)  # Be polite to the server

    print(f"[INFO] JICA PARTNER total: {len(jobs)} listings scored")
    return jobs


def scrape_activo() -> list[dict]:
    """Scrape Activo job listings (genre=1: international/cross-cultural).

    Server-rendered HTML. ~400 listings across ~14 pages (30/page).
    Job links: a[href*="/job/articles/"]
    Pagination: ?genre[]=1&page=N (stops when no listings found)
    Detail pages: /job/articles/{ID}
    """
    base_url = "https://activo.jp"
    collected = []  # list of (title, href)
    seen_links = set()

    # --- Pass 1: collect links from search pages ---
    for page in range(1, 20):  # Up to ~14 pages expected, with margin
        url = f"{base_url}/job/searchresult?genre[]=1&page={page}" if page > 1 else f"{base_url}/job/searchresult?genre[]=1"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            cards = soup.select("a[href*='/job/articles/']")
            if not cards:
                break  # No more results

            for card in cards:
                href = card.get("href", "")
                if not re.search(r"/job/articles/\d+", href):
                    continue
                if not href.startswith("http"):
                    href = base_url + href
                if href in seen_links:
                    continue
                seen_links.add(href)

                # Extract title from h3 inside the card
                h3 = card.select_one("h3")
                title = h3.get_text(strip=True) if h3 else card.get_text(strip=True)[:100]
                collected.append((title, href))

            print(f"[INFO] Activo page {page}: found {len(cards)} listings")

        except requests.RequestException as e:
            print(f"[WARN] Activo page {page} failed: {e}")
            break

        time.sleep(1)  # Be polite

    total = len(collected)
    print(f"[INFO] Activo search pages done: {total} listings collected — fetching detail pages...")

    # --- Pass 2: fetch detail pages and score ---
    jobs = []
    for idx, (title, href) in enumerate(collected, start=1):
        detail_text, detail_soup = fetch_job_detail(href)
        posted_at, deadline = extract_dates_from_json_ld(detail_soup) if detail_soup else (None, None)

        # Fallback: extract deadline from plain text if JSON-LD didn't have it
        if not deadline and detail_text:
            m = re.search(r"応募締切[：:\s]*(\d{4}[/\-]\d{2}[/\-]\d{2})", detail_text)
            if m:
                deadline = m.group(1).replace("/", "-")

        keyword_score = compute_ferrari_score(detail_text) if detail_text else 1
        jobs.append({
            "title": title,
            "link": href,
            "description": detail_text[:500] if detail_text else "",
            "source": "Activo",
            "score": keyword_score,
            "detail_text": detail_text,
            "score_rationale": "",
            "posted_at": posted_at,
            "deadline": deadline,
        })

        print(f"[INFO] Activo detail pages: {idx}/{total} fetched (keyword score: {keyword_score})")
        time.sleep(0.5)  # Be polite

    print(f"[INFO] Activo total: {len(jobs)} listings scored")
    return jobs


def scrape_jica_volunteer() -> list[dict]:
    """Scrape JICA Volunteer (JOCV) listings from the category browse page.

    Structure: Browse page lists ~129 categories with links → each category
    has paginated listings with inline details (country, org, requirements).
    Listing pages contain enough text for scoring without fetching detail pages.

    Only scrapes the active recruitment period (latest Spring/Fall).
    """
    base_url = "https://www.jocv-info.jica.go.jp/jv"
    browse_url = f"{base_url}/?m=BList"

    # --- Step 1: collect all category links from the browse page ---
    try:
        resp = requests.get(browse_url, headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"[ERROR] JICA Volunteer browse page failed: {e}")
        return []

    # Category links look like: ./index.php?m=List&jID=A101&n=y&period=2026%7C%E6%98%A5
    cat_links = []
    for a in soup.select("a[href*='m=List']"):
        href = a.get("href", "")
        if "jID=" in href and "period=" in href:
            if not href.startswith("http"):
                href = f"{base_url}/{href.lstrip('./')}"
            cat_links.append(href)

    # Deduplicate
    cat_links = list(dict.fromkeys(cat_links))
    print(f"[INFO] JICA Volunteer: {len(cat_links)} categories found")

    # --- Step 2: scrape listings from each category (paginated) ---
    collected = []  # list of dicts
    seen_links = set()

    for cat_idx, cat_url in enumerate(cat_links, 1):
        page = 1
        while True:
            page_url = cat_url if page == 1 else f"{cat_url}&page={page}"
            try:
                resp = requests.get(page_url, headers={"User-Agent": USER_AGENT}, timeout=30)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
            except requests.RequestException as e:
                print(f"[WARN] JICA Volunteer category page failed: {e}")
                break

            # Find detail links: ./index.php?m=Info&yID=...
            detail_links = soup.select("a[href*='m=Info']")
            if not detail_links:
                break

            for a in detail_links:
                href = a.get("href", "")
                if "yID=" not in href:
                    continue
                if not href.startswith("http"):
                    href = f"{base_url}/{href.lstrip('./')}"
                if href in seen_links:
                    continue
                seen_links.add(href)

                # Get the listing text: walk up to the containing block
                # The listing page has all info inline — grab surrounding text
                parent = a.find_parent("div") or a.find_parent("tr") or a.find_parent("td")
                if parent:
                    listing_text = parent.get_text(separator=" ", strip=True)
                else:
                    listing_text = ""

                # Extract a title from the listing text (country + job type)
                yid_match = re.search(r"yID=([A-Z0-9]+)", href)
                yid = yid_match.group(1) if yid_match else ""

                # Try to extract country and job type from the text
                title = listing_text[:120] if listing_text else f"JOCV Position {yid}"

                keyword_score = compute_ferrari_score(listing_text) if listing_text else 1
                collected.append({
                    "title": title,
                    "link": href,
                    "description": listing_text[:500] if listing_text else "",
                    "source": "JICA Volunteer",
                    "score": keyword_score,
                    "detail_text": listing_text,
                    "score_rationale": "",
                    "posted_at": None,
                    "deadline": None,
                })

            # Check for next page
            next_link = soup.select_one("a[href*='page=']")
            current_page_text = soup.get_text()
            if f"{page + 1}ページ" in current_page_text or soup.select_one(f"a[href*='page={page + 1}']"):
                page += 1
                time.sleep(0.5)
            else:
                break

        if cat_idx % 20 == 0:
            print(f"[INFO] JICA Volunteer: {cat_idx}/{len(cat_links)} categories scraped, {len(collected)} listings so far")
        time.sleep(0.3)  # Be polite between categories

    print(f"[INFO] JICA Volunteer total: {len(collected)} listings scored")
    return collected


# Registry of all scrapers
SCRAPERS = [
    scrape_jica_partner,
    scrape_activo,
    scrape_jica_volunteer,
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
    if any(kw in text for kw in ["教育", "教員", "teacher", "teaching", "instructor", "子ども", "children"]):
        angles.append("TESOL + TEC + Children's English Instructor certifications")
    if any(kw in text for kw in ["文化", "culture", "tea", "茶", "着物", "kimono", "伝統", "tradition"]):
        angles.append("Tea Ceremony Instructor, Kimono Meister — deep cultural expertise")
    if any(kw in text for kw in ["yoga", "ヨガ", "wellness", "健康"]):
        angles.append("RYT 200 certified yoga teacher")

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
    "**Tea Ceremony Instructor. Kimono Meister. Green Tea Instructor. Yoga Teacher. TESOL.** That's a highly sophisticated cultural ambassador portfolio. You don't just work across cultures, you *embody* them. 🎎",
    "**You were honored as an Interlocal Human Resource.** That's literally a government recognizing that you are a bridge between worlds. Any employer who doesn't see that clearly hasn't read the room. 🏅",
    "**13 certifications. Two degrees. Two continents. Seven languages in one newsletter.** You didn't just check boxes — you built a career that most people can't even imagine. The right role is catching up to you. 📜",
    "**Kimono Dresser Instructor + Johns Hopkins Safety Cert.** Name one other person on earth with that combination. You're not a generalist — you're *uniquely qualified* for roles that haven't been invented yet. 🌺",
    "**好香ちゃん、茶道と着物と安全管理とヨガと英語教育。全部できる人なんて世界中探してもほとんどいない。あなたは「何でも屋」じゃない。「何でもできる人」。それは強さ。** 🌟",
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
            "footer": {"text": "Dekiru! Fighto!"},
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

            # Translate title and rationale for qualifying jobs
            translated = translate_text(job["title"])
            rationale = job.get("score_rationale", "")
            rationale_jp = translate_text(rationale, target="ja") if rationale else ""

            row = {
                "title": job["title"],
                "link": job["link"],
                "description": job.get("description", "")[:500],
                "source": job["source"],
                "score": job["score"],
                "score_rationale": rationale,
                "score_rationale_jp": rationale_jp if rationale_jp != rationale else "",
                "translated_title": translated if translated != job["title"] else "",
                "seen_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "posted_at": job.get("posted_at"),
                "deadline": job.get("deadline"),
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
