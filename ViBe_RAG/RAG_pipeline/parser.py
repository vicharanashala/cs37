"""
scrape_and_clean.py
────────────────────────────────────────────────────────────────────────────
Step 1 + Step 2: Scrape → Clean → Structured JSON
────────────────────────────────────────────────────────────────────────────

Strategy
  1. Try to fetch live from the URL (requests + User-Agent spoofing).
  2. If the server returns 4xx/5xx or is unreachable, fall back to a local
     cached HTML file in  data/raw_html/<name>.html
     → In your CI/CD, save the raw HTML once (curl / Playwright), commit it,
       and the rest of the pipeline is reproducible without live network.

Output  →  data/raw_documents.json
Format per document:
  {
    "doc_id":   "faq_1_1",
    "source":   "faq",          # "faq" | "overview"
    "section":  "1. About the internship",
    "title":    "What is the Vicharanashala internship?",
    "content":  "A two-month internship run by ...",
    "url":      "https://samagama.in/internship/faq#q-1-1",
    "type":     "qa"            # "qa" | "prose"
  }
"""

import json
import os
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

# ── Config ────────────────────────────────────────────────────────────────────

PAGES = {
    "overview": "https://samagama.in/internship",
    "faq":      "https://samagama.in/internship/faq",
}
LOCAL_HTML = {
    "overview": "data/raw_html/overview.html",
    "faq":      "data/raw_html/faq.html",
}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
OUTPUT_DIR  = "data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "raw_documents.json")

# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class Document:
    doc_id:  str
    source:  str
    section: str
    title:   str
    content: str
    url:     str
    type:    str   # "qa" | "prose"

# ── Fetch helpers ─────────────────────────────────────────────────────────────

def load_soup(name: str) -> BeautifulSoup:
    """
    Try live fetch first; fall back to local cached HTML.
    In production you can also skip live fetch entirely and always use
    the cache — just set FORCE_LOCAL = True.
    """
    FORCE_LOCAL = True   # flip to True to always use local cache

    url        = PAGES[name]
    local_path = LOCAL_HTML[name]

    if not FORCE_LOCAL:
        try:
            print(f"  [live]  GET {url}")
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            # Save the raw HTML for reproducibility
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            Path(local_path).write_text(r.text, encoding="utf-8")
            print(f"  [cache] saved → {local_path}")
            return BeautifulSoup(r.text, "html.parser")
        except Exception as exc:
            print(f"  [warn]  live fetch failed ({exc}), using local cache")

    # Fall back to local cache
    if not os.path.exists(local_path):
        raise FileNotFoundError(
            f"No local cache at {local_path}. "
            "Run with FORCE_LOCAL=False once while the site is reachable, "
            "or manually save the HTML there."
        )
    print(f"  [cache] reading {local_path}")
    html = Path(local_path).read_text(encoding="utf-8")
    return BeautifulSoup(html, "html.parser")

# ── Text cleaning ─────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = re.sub(r"[\u200b\u200c\u200d\ufeff\xa0]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove § anchor symbols  (e.g. from  <a class="anchor">§</a>)
    text = re.sub(r"\s*§", "", text)
    # Remove leftover [§] patterns
    text = re.sub(r"\[§\]", "", text)
    return text.strip()

# ── Overview parser ───────────────────────────────────────────────────────────

def parse_overview(soup: BeautifulSoup) -> list[Document]:
    """
    Convert each h2 section of the overview page into one prose Document.
    """
    docs: list[Document] = []
    base = PAGES["overview"]
    body = soup.find("main") or soup.find("body")

    # ── Intro (everything before first h2) ──
    intro_parts: list[str] = []
    for tag in body.children:
        if isinstance(tag, NavigableString):
            continue
        if tag.name == "h2":
            break
        t = tag.get_text(separator=" ", strip=True)
        if t:
            intro_parts.append(t)

    if intro_parts:
        docs.append(Document(
            doc_id  = "overview_intro",
            source  = "overview",
            section = "Overview",
            title   = "Vicharanashala Internship — Introduction",
            content = clean_text("\n\n".join(intro_parts)),
            url     = base,
            type    = "prose",
        ))

    # ── h2 sections ──
    for idx, h2 in enumerate(body.find_all("h2")):
        section_title = clean_text(h2.get_text())
        anchor        = h2.get("id", f"s-{idx+1}")
        parts: list[str] = []

        for sib in h2.find_next_siblings():
            if sib.name == "h2":
                break
            t = sib.get_text(separator=" ", strip=True)
            if t:
                parts.append(t)

        content = clean_text("\n\n".join(parts))
        if not content:
            continue

        docs.append(Document(
            doc_id  = f"overview_{idx+1}",
            source  = "overview",
            section = "Overview",
            title   = section_title,
            content = content,
            url     = f"{base}#{anchor}",
            type    = "prose",
        ))

    return docs

# ── FAQ parser ────────────────────────────────────────────────────────────────


def parse_faq(soup: BeautifulSoup) -> list[Document]:
    """
    Convert each h2 section of the FAQ page into one prose Document.
    The FAQ has 13 numbered h2 sections (1–13), excluding the ToC heading.
    """
    docs: list[Document] = []
    base = PAGES["faq"]
    body = soup.find("main") or soup.find("body")

    for h2 in body.find_all("h2"):
        section_title = clean_text(h2.get_text())
        if section_title.lower() == "contents":
            continue

        anchor = h2.get("id", "")
        parts: list[str] = []

        for sib in h2.find_next_siblings():
            if sib.name == "h2":
                break
            t = sib.get_text(separator=" ", strip=True)
            if t:
                parts.append(t)

        content = clean_text("\n\n".join(parts))
        if not content:
            continue

        docs.append(Document(
            doc_id  = f"faq_{len(docs) + 1}",
            source  = "faq",
            section = section_title,
            title   = section_title,
            content = content,
            url     = f"{base}#{anchor}" if anchor else base,
            type    = "prose",
        ))

    return docs

# ── Dedup helper ──────────────────────────────────────────────────────────────

def dedup(docs: list[Document]) -> list[Document]:
    seen: set[str] = set()
    out:  list[Document] = []
    for d in docs:
        if d.doc_id not in seen:
            seen.add(d.doc_id)
            out.append(d)
    return out

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("\n── Step 1: Loading pages ───────────────────────────────")
    overview_soup = load_soup("overview")
    time.sleep(0.5)
    faq_soup      = load_soup("faq")

    print("\n── Step 2: Parsing & cleaning ──────────────────────────")
    overview_docs = parse_overview(overview_soup)
    faq_docs      = parse_faq(faq_soup)
    all_docs      = dedup(overview_docs + faq_docs)

    # Stats
    print(f"  Overview documents : {len(overview_docs)}")
    print(f"  FAQ documents      : {len(faq_docs)}")
    print(f"  Total (deduped)    : {len(all_docs)}")

    # Warn about empty docs
    empty = [d for d in all_docs if not d.content]
    if empty:
        print(f"  ⚠  {len(empty)} documents with empty content — check parser")

    # Save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump([asdict(d) for d in all_docs], f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved → {OUTPUT_FILE}")

    # Preview
    print("\n── Sample output ───────────────────────────────────────")
    for doc in all_docs[:4]:
        print(f"\n  [{doc.doc_id}]  {doc.title[:72]}")
        print(f"  Section : {doc.section}")
        print(f"  Type    : {doc.type}")
        preview = doc.content[:130].replace("\n", " ")
        print(f"  Content : {preview}...")
        print(f"  URL     : {doc.url}")

    # Section summary
    from collections import Counter
    sections = Counter(d.section for d in all_docs)
    print("\n── Documents per section ───────────────────────────────")
    for sec, cnt in sorted(sections.items(), key=lambda x: -x[1]):
        print(f"  {cnt:3}  {sec}")


if __name__ == "__main__":
    main()
