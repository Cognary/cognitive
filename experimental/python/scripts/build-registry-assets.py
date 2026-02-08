#!/usr/bin/env python3
"""
Build Cognitive Modules registry v2 index + per-module tarball assets (for GitHub Releases).

Outputs:
- dist/registry-assets/<module>-<version>.tar.gz
- cognitive-registry.v2.json (registry index v2)

The tarball layout matches the Node CLI safe extractor expectations:
<module-name>/... (single root directory, no extra top-level entries)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tarfile
import gzip
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ModuleMeta:
  name: str
  version: str
  tier: str
  responsibility: str


def read_module_yaml_scalars(path: Path) -> ModuleMeta:
  # Minimal YAML scalar parser: we only need top-level simple "key: value" lines.
  wanted = {"name", "version", "tier", "responsibility"}
  found: Dict[str, str] = {}

  for raw in path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
      continue
    m = re.match(r"^([a-zA-Z0-9_]+):\s*(.+?)\s*$", line)
    if not m:
      continue
    key = m.group(1)
    if key not in wanted:
      continue
    val = m.group(2).strip()
    # Remove simple surrounding quotes.
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
      val = val[1:-1]
    found[key] = val

  missing = [k for k in ["name", "version", "tier", "responsibility"] if k not in found]
  if missing:
    raise RuntimeError(f"module.yaml missing required keys {missing}: {path}")

  return ModuleMeta(
    name=found["name"],
    version=found["version"],
    tier=found["tier"],
    responsibility=found["responsibility"],
  )


def sha256_file(path: Path) -> str:
  h = hashlib.sha256()
  with path.open("rb") as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
      h.update(chunk)
  return h.hexdigest()


def list_files(module_dir: Path) -> List[str]:
  out: List[str] = []
  # Do not follow symlinks. A symlinked directory could cause unexpected traversal.
  for root, dirs, files in os.walk(module_dir, followlinks=False):
    root_path = Path(root)

    for d in list(dirs):
      p = root_path / d
      if p.is_symlink():
        raise RuntimeError(f"Refusing to package symlinked directory: {p}")

    for f in files:
      if f in [".DS_Store"]:
        continue
      p = root_path / f
      if p.is_symlink():
        raise RuntimeError(f"Refusing to package symlinked file: {p}")
      rel = p.relative_to(module_dir).as_posix()
      out.append(rel)
  out.sort()
  return out


def build_tarball(module_dir: Path, out_dir: Path, module_name: str, module_version: str) -> Path:
  out_dir.mkdir(parents=True, exist_ok=True)
  out_path = out_dir / f"{module_name}-{module_version}.tar.gz"

  # Create a deterministic tarball as much as possible:
  # - stable file ordering
  # - fixed mtime (0)
  # - stable uid/gid/uname/gname
  file_list = list_files(module_dir)

  # Important: gzip header includes an mtime by default. Fix it to 0 so checksums are stable
  # across environments (local vs CI).
  with out_path.open("wb") as raw:
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
      with tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tf:
        for rel in file_list:
          src = module_dir / rel
          arcname = f"{module_name}/{rel}"
          ti = tf.gettarinfo(str(src), arcname=arcname)
          ti.uid = 0
          ti.gid = 0
          ti.uname = "root"
          ti.gname = "root"
          ti.mtime = 0
          # Ensure regular files only (symlinks would be rejected by client)
          if ti.issym() or ti.islnk():
            raise RuntimeError(f"Refusing to package symlink/hardlink: {src}")
          with src.open("rb") as f:
            tf.addfile(ti, fileobj=f)

  return out_path


def load_registry_v1(path: Path) -> Dict[str, Any]:
  return json.loads(path.read_text(encoding="utf-8"))


def now_iso() -> str:
  return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument("--tag", required=True, help="GitHub release tag, e.g. v2.2.7")
  ap.add_argument("--modules-dir", default="cognitive/modules", help="Modules directory")
  ap.add_argument("--v1-registry", default="cognitive-registry.json", help="v1 registry index file (for tags/author/description)")
  ap.add_argument("--out-dir", default="dist/registry-assets", help="Output directory for tarballs")
  ap.add_argument("--registry-out", default="cognitive-registry.v2.json", help="Output registry v2 index JSON")
  ap.add_argument("--namespace", default="official", help="Namespace for published modules")
  ap.add_argument("--runtime-min", default="2.2.0", help="Minimum runtime version (x.y.z)")
  ap.add_argument("--repository", default="https://github.com/Cognary/cognitive", help="Repository URL")
  ap.add_argument("--homepage", default="https://cognary.github.io/cognitive/", help="Homepage URL")
  ap.add_argument("--license", default="MIT", help="SPDX license identifier to publish in registry entries")
  ap.add_argument(
    "--timestamp",
    default="",
    help="ISO timestamp to use for registry updated/entry timestamps (default: now, UTC).",
  )
  ap.add_argument("--only", action="append", default=[], help="Limit to a module name (repeatable)")

  args = ap.parse_args()

  repo_root = Path(__file__).resolve().parent.parent
  modules_dir = (repo_root / args.modules_dir).resolve()
  v1_path = (repo_root / args.v1_registry).resolve()
  out_dir = (repo_root / args.out_dir).resolve()
  registry_out = (repo_root / args.registry_out).resolve()

  v1 = load_registry_v1(v1_path)
  v1_modules = v1.get("modules", {})

  only = set([x.strip() for x in args.only if x.strip()])

  ts = args.timestamp.strip() or now_iso()

  entries: Dict[str, Any] = {}

  for module_yaml in sorted(modules_dir.glob("*/module.yaml")):
    mod_dir = module_yaml.parent
    meta = read_module_yaml_scalars(module_yaml)
    if only and meta.name not in only:
      continue

    v1_info = v1_modules.get(meta.name, {})
    description_zh = v1_info.get("description") or meta.responsibility
    author = v1_info.get("author") or "unknown"
    keywords = v1_info.get("tags") or []

    tar_path = build_tarball(mod_dir, out_dir, meta.name, meta.version)
    digest = sha256_file(tar_path)

    tarball_url = f"https://github.com/Cognary/cognitive/releases/download/{args.tag}/{tar_path.name}"

    entries[meta.name] = {
      "$schema": "https://cognitive-modules.dev/schema/registry-entry-v1.json",
      "identity": {
        "name": meta.name,
        "namespace": args.namespace,
        "version": meta.version,
        "spec_version": "2.2",
      },
      "metadata": {
        "description": description_zh,
        "description_zh": description_zh,
        "author": author,
        "tier": meta.tier,
        "license": args.license,
        "repository": args.repository,
        "homepage": args.homepage,
        "keywords": keywords,
      },
      "dependencies": {
        "runtime_min": args.runtime_min,
        "modules": [],
      },
      "distribution": {
        "tarball": tarball_url,
        "checksum": f"sha256:{digest}",
        "size_bytes": tar_path.stat().st_size,
        "files": list_files(mod_dir),
      },
      "timestamps": {
        "created_at": ts,
        "updated_at": ts,
        "deprecated_at": None,
      },
    }

  registry = {
    "$schema": "https://cognitive-modules.dev/schema/registry-v2.json",
    "version": "2.0.0",
    "updated": ts,
    "modules": entries,
    "categories": v1.get("categories", {}),
    "featured": list(entries.keys()),
    "stats": {
      "total_modules": len(entries),
      "total_downloads": 0,
      "last_updated": ts,
    },
  }

  # Keep the generated registry file ASCII-only for portability.
  registry_out.write_text(json.dumps(registry, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
  print(f"Wrote registry: {registry_out}")
  print(f"Wrote tarballs: {out_dir}")


if __name__ == "__main__":
  main()
