#!/usr/bin/env bash
# Install the repository's optional Agent Skills into a DSH skill root.
#
# Default target: $DSH_AGENTS_HOME/skills (normally ~/.agents/skills), the
# user-level root that DSH scans for every session.
# --project targets <repo>/.agents/skills instead, which DSH scans when a
# session's project root is this repository. That copy is gitignored.
#
# Existing skills are skipped unless --force is passed.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$root/skills"
project=0
force=0

for arg in "$@"; do
  case "$arg" in
    -p|--project) project=1 ;;
    -f|--force) force=1 ;;
    -h|--help)
      echo "Usage: $0 [--project] [--force]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

agents_home="${DSH_AGENTS_HOME:-$HOME/.agents}"
target="$agents_home/skills"
if [ "$project" -eq 1 ]; then
  target="$root/.agents/skills"
fi

if [ ! -d "$source_dir" ]; then
  echo "Missing skills directory: $source_dir" >&2
  exit 1
fi

mkdir -p "$target"
installed=0
skipped=0
shopt -s nullglob

for src in "$source_dir"/*/; do
  name="$(basename "$src")"
  dest="$target/$name"
  if [ -e "$dest" ]; then
    if [ "$force" -eq 1 ]; then
      rm -rf "$dest"
    else
      echo "Skip existing skill: $dest (use --force to replace)" >&2
      skipped=$((skipped + 1))
      continue
    fi
  fi
  cp -R "$src" "$dest"
  installed=$((installed + 1))
done

echo "Installed $installed skill(s) to $target"
if [ "$skipped" -gt 0 ]; then
  echo "Skipped $skipped existing skill(s); rerun with --force to replace them."
fi
