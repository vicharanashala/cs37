import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


DATA_DIR = Path(__file__).parent / "data"
RAW_HTML_DIR = DATA_DIR / "raw_html"
OUTPUT_PATH = DATA_DIR / "raw_documents.json"


def clean_html(html: str, source: str) -> dict | None:
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else source

    body = soup.find("body")
    if not body:
        return None

    lines = []
    for tag in body.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
        text = tag.get_text(strip=True)
        if not text:
            continue
        if tag.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            lines.append(f"\n{'#' * int(tag.name[1])} {text}\n")
        elif tag.name == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)

    content = "\n".join(lines).strip()
    if not content:
        return None

    content = re.sub(r"\n{3,}", "\n\n", content)

    return {
        "id": Path(source).stem,
        "title": title,
        "source": source,
        "content": content,
    }


def main():
    if not RAW_HTML_DIR.exists():
        print(f"error: {RAW_HTML_DIR} not found")
        return

    html_files = sorted(RAW_HTML_DIR.glob("*.html"))
    if not html_files:
        print(f"error: no .html files found in {RAW_HTML_DIR}")
        return

    documents = []
    for path in html_files:
        html = path.read_text(encoding="utf-8")
        doc = clean_html(html, path.name)
        if doc:
            documents.append(doc)
            print(f"[OK] {path.name}")
        else:
            print(f"[SKIP] {path.name} — no content extracted")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(documents, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\n=> {len(documents)} document(s) saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
