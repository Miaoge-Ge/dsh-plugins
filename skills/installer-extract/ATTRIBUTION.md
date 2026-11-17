# Attribution

Source: https://github.com/Miaoge-Ge/agent-skills/tree/main/personal_skill/installer-extract
Upstream revision: 4afb5fd5f5867036b8635a26c3c07e5c3f28bfa4
License: MIT (see LICENSE.txt), copyright Miaoge-Ge.

Local adaptation for DeepSeek Harness: copied as-is. The workflow is Windows-specific and
uses PowerShell plus local 7-Zip / innoextract when present.

Repository copy: vendored under `skills/`; use `scripts/install-skills.ps1` or
`scripts/install-skills.sh` to sync it to a DSH host.