"""Fail closed if CodeQL did not actually extract both exact GAS mirrors."""
import hashlib
import json
import os
from pathlib import Path
from zipfile import ZipFile

databases = json.loads(os.environ.get("CODEQL_DATABASES", "{}"))
manifest = json.loads(Path("security-analysis/manifest.json").read_text(encoding="utf-8"))
if not databases:
    raise SystemExit("CodeQL database locations unavailable; backend coverage unverified.")

found = set()
for database in databases.values():
    archive = Path(database) / "src.zip"
    if not archive.is_file():
        continue
    with ZipFile(archive) as sources:
        for entry in manifest:
            suffix = "security-analysis/apps-script/" + entry["mirror"]
            candidates = [name for name in sources.namelist() if name.replace("\\", "/").endswith(suffix)]
            if len(candidates) == 1 and hashlib.sha256(sources.read(candidates[0])).hexdigest() == entry["sha256"]:
                found.add(entry["source"])
expected = {entry["source"] for entry in manifest}
if found != expected:
    raise SystemExit("CodeQL did not archive every exact backend mirror; coverage must not be claimed.")
print("Verified extracted backend mirrors: " + ", ".join(sorted(found)))
