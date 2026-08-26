"""Validate delivery names, English text, UTF-8 files, and ASCII batch files."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {
    ".git",
    ".venv",
    ".acceptance",
    ".pytest_cache",
    ".pytest_tmp",
    ".npm-cache",
    "__pycache__",
    "node_modules",
    "dist",
}
BINARY_SUFFIXES = {
    ".db",
    ".ico",
    ".jpg",
    ".jpeg",
    ".png",
    ".pyc",
    ".rar",
    ".woff",
    ".woff2",
    ".xlsx",
    ".zip",
}
RAW_DATA_PATHS = {
    Path("All_Mandates.csv"),
    Path("data/notable_events.csv"),
    Path("data/release/mandates.csv"),
    Path("data_updates/end_dates_2026-08-21.csv"),
}
VALID_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
HAN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
CHINESE_PUNCTUATION = re.compile(r"[\u3000-\u303f\ufe10-\ufe1f\ufe30-\ufe4f]")
EMOJI = re.compile(r"[\u2600-\u27bf\U0001f300-\U0001faff]")


def included(path: Path) -> bool:
    return not any(part in EXCLUDED_PARTS for part in path.parts)


def scan(root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    notices: list[str] = []
    files = sorted(path for path in root.rglob("*") if path.is_file() and included(path))

    checked_directories: set[Path] = set()
    for path in files:
        relative = path.relative_to(root)
        for parent in relative.parents:
            if parent == Path(".") or parent in checked_directories:
                continue
            checked_directories.add(parent)
            if HAN.search(parent.name):
                errors.append(f"Chinese character in directory name: {parent}")
            if not VALID_NAME.fullmatch(parent.name):
                errors.append(f"Invalid generated directory name: {parent}")

        if HAN.search(relative.name):
            errors.append(f"Chinese character in file name: {relative}")
        if not VALID_NAME.fullmatch(relative.name):
            errors.append(f"Invalid generated file name: {relative}")

        suffix = path.suffix.lower()
        content = path.read_bytes()
        if suffix in {".bat", ".cmd"}:
            try:
                content.decode("ascii")
            except UnicodeDecodeError:
                errors.append(f"Non-ASCII batch content: {relative}")
            if b"\n" in content and content.count(b"\n") != content.count(b"\r\n"):
                errors.append(f"Batch file does not use CRLF line endings: {relative}")
            continue
        if suffix in BINARY_SUFFIXES:
            continue

        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            errors.append(f"Text file is not valid UTF-8: {relative}")
            continue

        matches = {
            "Chinese characters": len(HAN.findall(text)),
            "Chinese punctuation": len(CHINESE_PUNCTUATION.findall(text)),
            "Emoji": len(EMOJI.findall(text)),
        }
        detected = {label: count for label, count in matches.items() if count}
        if not detected:
            continue
        if relative in RAW_DATA_PATHS:
            notices.append(f"Preserved source data in {relative}: {detected}")
        else:
            errors.append(f"Disallowed characters in {relative}: {detected}")

    return errors, notices


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan generated delivery content")
    parser.add_argument("--root", type=Path, default=PROJECT_ROOT)
    args = parser.parse_args()
    errors, notices = scan(args.root.resolve())
    for notice in notices:
        print(f"[INFO] {notice}")
    for error in errors:
        print(f"[ERROR] {error}")
    if errors:
        print(f"[ERROR] Character scan failed with {len(errors)} finding(s).")
        raise SystemExit(1)
    print("[OK] No Chinese characters in generated file or directory names.")
    print("[OK] No Chinese characters in scripts, code comments, logs, UI text, or documentation.")
    print("[OK] No non-ASCII characters in .bat and .cmd files.")
    if notices:
        print("[INFO] Remaining restricted characters exist only in preserved source data.")
    else:
        print("[OK] No remaining Chinese characters were found in preserved source data.")


if __name__ == "__main__":
    main()
