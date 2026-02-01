"""
Module Registry - Discover and manage cognitive modules.

Search order:
1. ./cognitive/modules (project-local)
2. ~/.cognitive/modules (user-global)
3. /usr/local/share/cognitive/modules (system-wide, optional)
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

# Standard module search paths
SEARCH_PATHS = [
    Path.cwd() / "cognitive" / "modules",  # Project-local
    Path.home() / ".cognitive" / "modules",  # User-global
    Path("/usr/local/share/cognitive/modules"),  # System-wide
]

# User global install location
USER_MODULES_DIR = Path.home() / ".cognitive" / "modules"


def get_search_paths() -> list[Path]:
    """Get all module search paths, including custom paths from env."""
    paths = SEARCH_PATHS.copy()
    
    # Add custom paths from environment
    custom = os.environ.get("COGNITIVE_MODULES_PATH")
    if custom:
        for p in custom.split(":"):
            paths.insert(0, Path(p))
    
    return paths


def find_module(name: str) -> Optional[Path]:
    """Find a module by name, searching all paths in order."""
    for base_path in get_search_paths():
        module_path = base_path / name
        if module_path.exists() and (module_path / "module.md").exists():
            return module_path
    return None


def list_modules() -> list[dict]:
    """List all available modules from all search paths."""
    modules = []
    seen = set()
    
    for base_path in get_search_paths():
        if not base_path.exists():
            continue
        
        for module_dir in base_path.iterdir():
            if not module_dir.is_dir():
                continue
            if module_dir.name in seen:
                continue
            if not (module_dir / "module.md").exists():
                continue
            
            seen.add(module_dir.name)
            modules.append({
                "name": module_dir.name,
                "path": module_dir,
                "location": "local" if base_path == SEARCH_PATHS[0] else "global",
            })
    
    return modules


def ensure_user_modules_dir() -> Path:
    """Ensure user global modules directory exists."""
    USER_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    return USER_MODULES_DIR


def install_from_local(source: Path, name: Optional[str] = None) -> Path:
    """Install a module from a local path."""
    source = Path(source).resolve()
    if not source.exists():
        raise FileNotFoundError(f"Source not found: {source}")
    
    if not (source / "module.md").exists():
        raise ValueError(f"Not a valid module (missing module.md): {source}")
    
    module_name = name or source.name
    target = ensure_user_modules_dir() / module_name
    
    if target.exists():
        shutil.rmtree(target)
    
    shutil.copytree(source, target)
    return target


def install_from_git(url: str, subdir: Optional[str] = None, name: Optional[str] = None) -> Path:
    """
    Install a module from a git repository.
    
    Supports:
    - github:org/repo/path/to/module
    - git+https://github.com/org/repo#subdir=path/to/module
    - https://github.com/org/repo (with subdir parameter)
    """
    # Parse github: shorthand
    if url.startswith("github:"):
        parts = url[7:].split("/", 2)
        if len(parts) < 2:
            raise ValueError(f"Invalid github URL: {url}")
        org, repo = parts[0], parts[1]
        if len(parts) == 3:
            subdir = parts[2]
        url = f"https://github.com/{org}/{repo}.git"
    
    # Parse git+https:// with fragment
    elif url.startswith("git+"):
        url = url[4:]
        if "#" in url:
            url, fragment = url.split("#", 1)
            for part in fragment.split("&"):
                if part.startswith("subdir="):
                    subdir = part[7:]
    
    # Clone to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        
        # Shallow clone
        result = subprocess.run(
            ["git", "clone", "--depth", "1", url, str(tmppath / "repo")],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"Git clone failed: {result.stderr}")
        
        # Find module source
        source = tmppath / "repo"
        if subdir:
            source = source / subdir
        
        if not source.exists():
            raise FileNotFoundError(f"Subdir not found: {subdir}")
        
        # Determine module name
        module_name = name or source.name
        
        # Install from cloned source
        return install_from_local(source, module_name)


def install_module(source: str, name: Optional[str] = None) -> Path:
    """
    Install a module from various sources.
    
    Sources:
    - local:/path/to/module
    - github:org/repo/path/to/module
    - git+https://github.com/org/repo#subdir=path
    - /absolute/path (treated as local)
    - ./relative/path (treated as local)
    """
    if source.startswith("local:"):
        return install_from_local(Path(source[6:]), name)
    elif source.startswith("github:") or source.startswith("git+"):
        return install_from_git(source, name=name)
    elif source.startswith("/") or source.startswith("./") or source.startswith(".."):
        return install_from_local(Path(source), name)
    elif source.startswith("https://github.com"):
        return install_from_git(source, name=name)
    else:
        # Assume it's a local path
        return install_from_local(Path(source), name)


def uninstall_module(name: str) -> bool:
    """Uninstall a module from user global location."""
    target = USER_MODULES_DIR / name
    if target.exists():
        shutil.rmtree(target)
        return True
    return False
