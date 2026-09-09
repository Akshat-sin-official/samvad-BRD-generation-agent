"""
Load and sample from the Enron emails CSV.
- When USE_ENRON_SIMULATION=1 (default): return simulated Enron-style fluff only (no file read).
- Otherwise: read from local dataset/emails/emails.csv, or DATASET_EMAILS_CSV_PATH, or Kaggle.
"""
import csv
import io
import os
from pathlib import Path
from typing import Optional

from ..config import DATASET_EMAILS_CSV_PATH as _ENV_CSV_PATH, USE_ENRON_SIMULATION

# Project root: backend/services -> backend -> project root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_DEFAULT_CSV_PATH = _PROJECT_ROOT / "dataset" / "emails" / "emails.csv"

# Kaggle Enron dataset (optional, when USE_KAGGLE=1 and local file missing)
_KAGGLE_DATASET = "wcukierski/enron-email-dataset"
_KAGGLE_CSV_NAME = "emails.csv"

# Read only enough for 50 rows (avoids loading the full 1.43 GB file)
MAX_READ_BYTES = 2 * 1024 * 1024  # 2 MB — enough for 50 emails
MAX_SAMPLE_CHARS = 150_000
MAX_EMAILS = 50
MAX_EMAIL_CHARS = 8_000


def get_simulated_enron_sample(num_emails: int = 50) -> str:
    """
    Return simulated Enron-style email content (fluff only, no real data).
    Used when USE_ENRON_SIMULATION=1 so the app never reads the actual CSV.
    """
    # Enron-themed fluff: realistic headers and generic corporate body text
    senders = [
        "john.smith", "sarah.chen", "mike.johnson", "lisa.wang", "david.kim",
        "jennifer.brown", "robert.taylor", "amy.davis", "james.wilson", "maria.garcia",
    ]
    subjects = [
        "Re: Q4 budget review",
        "Project update – Enron North",
        "Meeting tomorrow 10am",
        "Weekly status report",
        "Re: Contract discussion",
        "Please review attached",
        "Action required: approval",
        "Calendar invite – strategy sync",
        "Re: Vendor follow-up",
        "Reminder: compliance training",
        "Draft proposal for review",
        "Re: Pipeline numbers",
        "FYI – market update",
        "Request for feedback",
        "Quarterly goals alignment",
    ]
    body_snippets = [
        "Hi team, please find below a brief update on the project timeline. We are aligning with stakeholders and will share a revised deck by EOW.",
        "Thanks for the notes. I have incorporated the feedback and attached the latest version. Let me know if you have any further comments.",
        "Could we schedule a short call this week to discuss the next steps? I am available Tuesday or Wednesday afternoon.",
        "Per our conversation, I am following up with the requested information. Please see the summary below and advise.",
        "This is a reminder that the deadline for submissions is Friday. Please ensure your section is complete and sent to the distribution list.",
        "I wanted to circle back on the action items from last week's meeting. We are on track for the first milestone.",
        "Please review the attached document and indicate your approval or suggested changes by end of day Thursday.",
        "Quick update: the vendor has confirmed availability. We can proceed with the pilot as discussed.",
        "For your reference, here are the key figures from the latest run. Let me know if you need a deeper breakdown.",
        "Following up on the compliance training – all materials are in the shared folder. Completion is required by month end.",
    ]
    sep = "\n\n---\n\n"
    chunks = []
    for i in range(min(num_emails, 50)):
        s = senders[i % len(senders)]
        subj = subjects[i % len(subjects)]
        body = body_snippets[i % len(body_snippets)]
        msg = (
            f"From: {s}@enron.com\n"
            f"To: team@enron.com\n"
            f"Subject: {subj}\n"
            f"Date: Mon, 15 Oct 2001 09:{i:02d}:00 -0500\n"
            f"X-From: {s}\n"
            f"\n{body}"
        )
        chunks.append(msg)
    out = sep.join(chunks)
    print(f"[DatasetLoader] Returning simulated Enron sample ({len(chunks)} emails, {len(out)} chars)")
    return out


def _load_via_kaggle() -> Optional[Path]:
    """If USE_KAGGLE=1 and kagglehub is installed, download dataset and return path to CSV."""
    if os.environ.get("USE_KAGGLE", "").strip().lower() not in ("1", "true", "yes"):
        return None
    try:
        import kagglehub
        root = kagglehub.dataset_download(_KAGGLE_DATASET)
        path = Path(root) / _KAGGLE_CSV_NAME
        if path.exists():
            print(f"[DatasetLoader] Using Kaggle dataset at {path}")
            return path
        # Some versions use different layout
        for p in Path(root).rglob("*.csv"):
            if "email" in p.name.lower():
                print(f"[DatasetLoader] Using Kaggle CSV at {p}")
                return p
    except Exception as e:
        print(f"[DatasetLoader] Kaggle fallback skipped: {e}")
    return None


def load_email_sample(
    csv_path: Optional[Path] = None,
    max_read_bytes: int = MAX_READ_BYTES,
    max_emails: int = MAX_EMAILS,
    max_total_chars: int = MAX_SAMPLE_CHARS,
) -> str:
    """
    When USE_ENRON_SIMULATION=1 (default), returns simulated Enron-style fluff only (no file read).
    Otherwise loads from CSV: csv_path, or dataset/emails/emails.csv, or Kaggle.
    """
    if USE_ENRON_SIMULATION:
        return get_simulated_enron_sample(num_emails=max_emails)

    path = csv_path or (_DEFAULT_CSV_PATH if not (_ENV_CSV_PATH and _ENV_CSV_PATH.strip()) else Path(_ENV_CSV_PATH.strip()))
    if not path.exists():
        cwd_path = Path.cwd() / "dataset" / "emails" / "emails.csv"
        if cwd_path.exists():
            path = cwd_path
    if not path or not path.exists():
        path = _load_via_kaggle()
    if not path or not path.exists():
        print(f"[DatasetLoader] File not found: {_DEFAULT_CSV_PATH} and {Path.cwd() / 'dataset/emails/emails.csv'} (set USE_KAGGLE=1 for Kaggle fallback)")
        return ""

    chunks: list[str] = []
    total_chars = 0
    count = 0

    try:
        with open(path, "rb") as f:
            raw = f.read(max_read_bytes)
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if "message" not in (reader.fieldnames or []):
            print("[DatasetLoader] CSV has no 'message' column")
            return ""

        for row in reader:
            if count >= max_emails or total_chars >= max_total_chars:
                break
            msg = row.get("message") or ""
            if not msg.strip():
                continue
            if len(msg) > MAX_EMAIL_CHARS:
                msg = msg[:MAX_EMAIL_CHARS] + "\n[... truncated ...]"
            chunks.append(msg)
            total_chars += len(msg)
            count += 1

        if not chunks:
            print("[DatasetLoader] No rows read (file may be empty or format different)")
            return ""

        out = "\n\n---\n\n".join(chunks)
        print(f"[DatasetLoader] Read first {max_read_bytes / (1024*1024):.0f} MB, got {count} emails, {len(out)} chars from {path.name}")
        return out

    except Exception as e:
        print(f"[DatasetLoader] Error reading {path}: {e}")
        return ""
