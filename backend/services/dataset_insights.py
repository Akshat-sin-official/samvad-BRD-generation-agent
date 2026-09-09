"""
Chunked extraction from Enron emails CSV to produce insight JSON for the BRD engine.
Columns: file, message. Never loads the full 1.4GB file.

Goals:
- Extract risk patterns (fraud, breach, confidential, escalation, etc.)
- Detect PII exposure (PAN, Aadhaar, SSN, card patterns)
- Discover recurring entities (mailboxes from file path)
- Category buckets from Subject/body keywords

Output: structured dict to feed into BRD generator as "Dataset-derived insights".
"""
import csv
import io
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Optional

# Same path resolution as dataset_loader
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_DEFAULT_CSV_PATH = _PROJECT_ROOT / "dataset" / "emails" / "emails.csv"

# Process only 50 rows; read just enough bytes to get them
MAX_READ_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_ROWS = 50

# Risk-related keywords (message body + subject)
RISK_KEYWORDS = re.compile(
    r"\b(fraud|unauthorized|breach|confidential|legal|audit|complaint|escalat|violation|"
    r"compliance|regulat|subpoena|lawsuit|settlement|dispute|misconduct)\b",
    re.I,
)

# PII patterns (Indian PAN, Aadhaar; SSN; generic card-like)
PAN_PATTERN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
AADHAAR_PATTERN = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
CARD_PATTERN = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")

# Category buckets (from subject/body)
CATEGORY_KEYWORDS = {
    "billing": re.compile(r"\b(billing|invoice|payment|refund|charge)\b", re.I),
    "technical": re.compile(r"\b(api|bug|error|outage|deploy|technical)\b", re.I),
    "hr": re.compile(r"\b(hire|terminat|salary|leave|policy)\b", re.I),
    "legal": re.compile(r"\b(legal|contract|agreement|compliance)\b", re.I),
    "project": re.compile(r"\b(deadline|milestone|scope|deliverable|project)\b", re.I),
}


def _resolve_path(csv_path: Optional[Path] = None) -> Optional[Path]:
    """Resolve CSV path: explicit > env > default > cwd > Kaggle (same order as dataset_loader)."""
    try:
        from ..config import DATASET_EMAILS_CSV_PATH as _ENV
        path = csv_path or (Path(_ENV.strip()) if (_ENV or "").strip() else _DEFAULT_CSV_PATH)
    except Exception:
        path = csv_path or _DEFAULT_CSV_PATH
    if path and path.exists():
        return path
    cwd = Path.cwd() / "dataset" / "emails" / "emails.csv"
    if cwd.exists():
        return cwd
    if os.environ.get("USE_KAGGLE", "").strip().lower() in ("1", "true", "yes"):
        try:
            import kagglehub
            root = kagglehub.dataset_download("wcukierski/enron-email-dataset")
            for p in Path(root).rglob("*.csv"):
                if "email" in p.name.lower():
                    return p
        except Exception:
            pass
    return None


def _contains_pii(text: str) -> bool:
    if not text or len(text) > 100_000:
        return False
    return bool(
        PAN_PATTERN.search(text)
        or AADHAAR_PATTERN.search(text)
        or SSN_PATTERN.search(text)
        or CARD_PATTERN.search(text)
    )


def _mailbox_from_file(file_val: str) -> str:
    if not file_val:
        return "unknown"
    part = (file_val.split("/") or [file_val])[0].strip()
    return part or "unknown"


def _category_from_message(msg: str) -> Optional[str]:
    if not msg:
        return None
    sample = msg[:4000] if len(msg) > 4000 else msg
    for name, pat in CATEGORY_KEYWORDS.items():
        if pat.search(sample):
            return name
    return None


def get_simulated_enron_insights() -> dict[str, Any]:
    """Return fluff insights for simulated Enron dataset (no CSV read)."""
    # Matches the simulated senders/subjects/categories from dataset_loader fluff
    out = {
        "total_messages_processed": 50,
        "bytes_read_mb": 0.1,
        "risk_message_count": 3,
        "risk_message_pct": 6.0,
        "pii_exposure_count": 0,
        "pii_exposure_pct": 0.0,
        "top_mailboxes": [
            {"name": "john.smith", "count": 5},
            {"name": "sarah.chen", "count": 5},
            {"name": "mike.johnson", "count": 5},
            {"name": "lisa.wang", "count": 5},
            {"name": "david.kim", "count": 5},
        ],
        "top_categories": [
            {"name": "project", "count": 12},
            {"name": "legal", "count": 8},
            {"name": "billing", "count": 4},
        ],
        "unique_mailboxes": 10,
    }
    print("[DatasetInsights] Returning simulated Enron insights (50 messages)")
    return out


def extract_insights(
    csv_path: Optional[Path] = None,
    max_read_bytes: int = MAX_READ_BYTES,
    max_rows: int = MAX_ROWS,
) -> dict[str, Any]:
    """
    Stream CSV in chunks, extract risk/PII/entities/categories.
    When USE_ENRON_SIMULATION=1, returns simulated fluff insights (no file read).
    """
    try:
        from ..config import USE_ENRON_SIMULATION
        if USE_ENRON_SIMULATION:
            return get_simulated_enron_insights()
    except Exception:
        pass
    path = _resolve_path(csv_path)
    if not path:
        return {"error": "dataset_not_found", "total_messages_processed": 0}

    risk_count = 0
    pii_count = 0
    mailboxes: Counter = Counter()
    categories: Counter = Counter()
    total = 0
    bytes_read = 0

    try:
        with open(path, "rb") as f:
            raw = f.read(max_read_bytes)
        bytes_read = len(raw)
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if "file" not in (reader.fieldnames or []) or "message" not in (reader.fieldnames or []):
            return {"error": "invalid_columns", "total_messages_processed": 0}

        for row in reader:
            if total >= max_rows:
                break
            total += 1
            file_val = (row.get("file") or "").strip()
            msg = row.get("message") or ""

            if RISK_KEYWORDS.search(msg):
                risk_count += 1
            if _contains_pii(msg):
                pii_count += 1
            mailboxes[_mailbox_from_file(file_val)] += 1
            cat = _category_from_message(msg)
            if cat:
                categories[cat] += 1

        top_mailboxes = [{"name": k, "count": v} for k, v in mailboxes.most_common(15)]
        top_categories = [{"name": k, "count": v} for k, v in categories.most_common(10)]

        pct_risk = round(100 * risk_count / total, 1) if total else 0
        pct_pii = round(100 * pii_count / total, 1) if total else 0

        out = {
            "total_messages_processed": total,
            "bytes_read_mb": round(bytes_read / (1024 * 1024), 1),
            "risk_message_count": risk_count,
            "risk_message_pct": pct_risk,
            "pii_exposure_count": pii_count,
            "pii_exposure_pct": pct_pii,
            "top_mailboxes": top_mailboxes,
            "top_categories": top_categories,
            "unique_mailboxes": len(mailboxes),
        }
        print(f"[DatasetInsights] Processed {total} rows, risk={risk_count}, pii={pii_count}, mailboxes={len(mailboxes)}")
        return out
    except Exception as e:
        print(f"[DatasetInsights] Error: {e}")
        return {"error": str(e), "total_messages_processed": total}


def insights_to_brd_context(insights: dict[str, Any]) -> str:
    """Turn insight dict into a short text block for BRD prompt context."""
    if insights.get("error") or not insights.get("total_messages_processed"):
        return ""

    cat_str = ", ".join(f"{c['name']}({c['count']})" for c in insights.get("top_categories", [])[:5])
    mb_str = ", ".join(f"{m['name']}({m['count']})" for m in insights.get("top_mailboxes", [])[:5])
    lines = [
        "=== Dataset-derived insights (Enron emails CSV) — use to inform requirements ===",
        f"Total messages analyzed: {insights['total_messages_processed']} (first {insights.get('bytes_read_mb', 0)} MB of file).",
        f"Risk-related messages (fraud, breach, confidential, legal, etc.): {insights.get('risk_message_count', 0)} ({insights.get('risk_message_pct', 0)}%).",
        f"Messages with potential PII (PAN/Aadhaar/SSN/card patterns): {insights.get('pii_exposure_count', 0)} ({insights.get('pii_exposure_pct', 0)}%).",
        f"Unique mailboxes (senders/folders): {insights.get('unique_mailboxes', 0)}.",
        "Top categories by keyword: " + (cat_str or "—") + ".",
        "Top mailboxes by volume: " + (mb_str or "—") + ".",
        "→ Suggest requirements for: risk detection, PII masking, audit trails, and categorization based on these counts.",
    ]
    return "\n".join(lines)
