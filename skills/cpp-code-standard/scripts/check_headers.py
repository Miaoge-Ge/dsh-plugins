#!/usr/bin/env python3
"""Lightweight header checker for the cpp-code-standard skill.

Checks that C/C++ files have a Doxygen file header with @file and @brief,
that headers use #pragma once or an include guard, and that headers do not
pull in a whole namespace with 'using namespace'.

Usage:
    python check_headers.py [paths...] [--strict]

--strict also requires every .h/.hpp declaration block to contain @brief
(a coarse check; review the output rather than treating it as proof).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SOURCE_SUFFIXES = {".c", ".cc", ".cpp", ".cxx"}
HEADER_SUFFIXES = {".h", ".hh", ".hpp", ".hxx"}
ALL_SUFFIXES = SOURCE_SUFFIXES | HEADER_SUFFIXES

DOXYGEN_FILE = re.compile(r"@file\b")
DOXYGEN_BRIEF = re.compile(r"@brief\b")
PRAGMA_ONCE = re.compile(r"^\s*#\s*pragma\s+once\b", re.MULTILINE)
INCLUDE_GUARD = re.compile(r"^\s*#\s*ifndef\s+\w+.*?^\s*#\s*define\s+\w+", re.MULTILINE | re.DOTALL)
USING_NAMESPACE = re.compile(r"^\s*using\s+namespace\b", re.MULTILINE)
BRIEF = re.compile(r"@brief\b")


def iter_files(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            for candidate in sorted(path.rglob("*")):
                if candidate.is_file() and candidate.suffix.lower() in ALL_SUFFIXES:
                    files.append(candidate)
        elif path.is_file():
            files.append(path)
        else:
            print(f"{raw}: no such file or directory", file=sys.stderr)
    return files


def check_file(path: Path, strict: bool) -> list[tuple[int, str, str]]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")

    problems: list[tuple[int, str, str]] = []
    header = "\n".join(text.splitlines()[:60])
    suffix = path.suffix.lower()

    if not DOXYGEN_FILE.search(header):
        problems.append((1, "DOC001", "missing Doxygen @file in the file header"))
    if not DOXYGEN_BRIEF.search(header):
        problems.append((1, "DOC002", "missing Doxygen @brief in the file header"))

    if suffix in HEADER_SUFFIXES:
        if not PRAGMA_ONCE.search(header) and not INCLUDE_GUARD.search(header):
            problems.append((1, "HDR001", "header has neither #pragma once nor an include guard"))
        for match in USING_NAMESPACE.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            problems.append((line, "NS001", "using namespace in a header"))

    if strict and suffix in HEADER_SUFFIXES:
        if not BRIEF.search(text):
            problems.append((1, "DOC003", "header has no @brief for declarations"))

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description="Check C/C++ headers against cpp-code-standard.")
    parser.add_argument("paths", nargs="*", default=["."], help="Files or directories (default: .)")
    parser.add_argument("--strict", action="store_true", help="Also require @brief in header declarations")
    args = parser.parse_args()

    files = iter_files(args.paths)
    if not files:
        print("No C/C++ files found.", file=sys.stderr)
        return 1

    total = 0
    failed = 0
    for path in files:
        problems = check_file(path, args.strict)
        if not problems:
            continue
        failed += 1
        for line, rule, message in problems:
            print(f"{path}:{line}: {rule} {message}")
            total += 1

    print(f"\nChecked {len(files)} file(s); {total} problem(s) in {failed} file(s).", file=sys.stderr)
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
