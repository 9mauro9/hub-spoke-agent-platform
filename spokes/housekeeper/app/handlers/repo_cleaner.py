"""
Repository Noise Cleaner handler for Spoke Housekeeper.
Purges development clutter, OS files, build caches, and orphaned test logs.
"""

from __future__ import annotations
import os
import shutil
import fnmatch
from typing import Dict, Any, List, Optional


DEFAULT_NOISE_PATTERNS = [
    ".DS_Store",
    "Thumbs.db",
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "npm-debug.log",
    "yarn-error.log",
    "*.log",
    "*~",
]


def clean_repo_noise(
    repo_path: str,
    dry_run: bool = False,
    noise_patterns: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Scans repo_path recursively and removes files or directories matching noise patterns.
    """
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")

    patterns = noise_patterns or DEFAULT_NOISE_PATTERNS
    scanned_count = 0
    deleted_files: List[str] = []
    deleted_dirs: List[str] = []
    freed_bytes = 0

    for root, dirs, files in os.walk(repo_path, topdown=False):
        # Inspect files
        for filename in files:
            scanned_count += 1
            rel_path = os.path.relpath(os.path.join(root, filename), repo_path)
            matches = any(fnmatch.fnmatch(filename, pat) for pat in patterns)
            if matches:
                full_path = os.path.join(root, filename)
                try:
                    fsize = os.path.getsize(full_path)
                except OSError:
                    fsize = 0
                freed_bytes += fsize
                deleted_files.append(rel_path)
                if not dry_run:
                    try:
                        os.remove(full_path)
                    except Exception as e:
                        print(f"Warning: Could not remove file {full_path}: {e}")

        # Inspect directories (like __pycache__, .pytest_cache)
        for dirname in dirs:
            matches = any(fnmatch.fnmatch(dirname, pat) for pat in patterns)
            if matches:
                full_path = os.path.join(root, dirname)
                rel_dir = os.path.relpath(full_path, repo_path)
                deleted_dirs.append(rel_dir)
                if not dry_run:
                    try:
                        shutil.rmtree(full_path, ignore_errors=True)
                    except Exception as e:
                        print(f"Warning: Could not remove directory {full_path}: {e}")

    return {
        "repository_path": repo_path,
        "dry_run": dry_run,
        "scanned_files_count": scanned_count,
        "deleted_files_count": len(deleted_files),
        "deleted_dirs_count": len(deleted_dirs),
        "deleted_files": deleted_files,
        "deleted_dirs": deleted_dirs,
        "freed_bytes": freed_bytes,
        "status": "success",
    }
