# Attribution

Source: https://github.com/anthropics/skills/tree/main/skills/mcp-builder
Upstream revision: 2c5958ecac7cee2b583967a2c4981d0f4a75c579
License: Apache License 2.0 (see LICENSE.txt)

Local adaptation for DeepSeek Harness:
- Replaced the Claude `WebFetch` tool name with DSH's `web_fetch`.
- Added a section on wiring the finished MCP server through a DSH Cordis bundle.
- Noted that the optional Anthropic-SDK evaluation script is upstream-only.

Repository copy: vendored under `skills/`; use `scripts/install-skills.ps1` or `scripts/install-skills.sh` to sync it to a DSH host.
