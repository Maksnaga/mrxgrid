#!/usr/bin/env python3
"""Strip 'Divergences connues' / 'Divergences résiduelles' sections from
all spec / portal Markdown docs. The lib isn't in production yet — known
divergences aren't relevant.

Algorithm per file:
- Read lines.
- Find each heading line matching `^#+\s+Divergences? (?:connue|résiduelle)`.
- Determine its level (= number of `#`).
- Remove from that line until the next line starting with `^#{1,level}\s` (a
  heading at the same level or shallower — meaning the section is closed).
- Also strip trailing blank lines just before deletion to avoid leaving
  double blank lines.
"""
from pathlib import Path
import re

import os
ROOT = Path(os.environ.get("MRXGRID_ROOT") or Path(__file__).resolve().parent.parent)
TARGETS = [
    ROOT / "packages/docs",
    ROOT / "apps/storybook-portal/stories",
]
HEADING_RE = re.compile(r"^(#+)\s+Divergences?\b.*$", re.IGNORECASE)
ANY_HEADING_RE = re.compile(r"^(#+)\s+\S")


def strip(path: Path) -> int:
    """Return number of sections removed."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    out = []
    i = 0
    removed = 0
    while i < len(lines):
        m = HEADING_RE.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue
        level = len(m.group(1))
        # Drop trailing blank lines from `out` so we don't leave gaps.
        while out and out[-1].strip() == "":
            out.pop()
        # Skip until next heading at same or shallower level.
        i += 1
        while i < len(lines):
            mh = ANY_HEADING_RE.match(lines[i])
            if mh and len(mh.group(1)) <= level:
                break
            i += 1
        removed += 1
        # Ensure a single blank line between the previous content and what follows.
        if out and out[-1].strip() != "":
            out.append("")
    new = "\n".join(out)
    # Collapse 3+ blank lines into 2.
    new = re.sub(r"\n{3,}", "\n\n", new)
    if new != text:
        path.write_text(new, encoding="utf-8")
    return removed


def main() -> None:
    total_sections = 0
    files_touched = 0
    for root in TARGETS:
        for p in sorted(root.rglob("*.md")):
            n = strip(p)
            if n:
                files_touched += 1
                total_sections += n
                print(f"  {p.relative_to(ROOT)}: -{n} section{'s' if n>1 else ''}")
        for p in sorted(root.rglob("*.mdx")):
            n = strip(p)
            if n:
                files_touched += 1
                total_sections += n
                print(f"  {p.relative_to(ROOT)}: -{n} section{'s' if n>1 else ''}")
    print(f"\nDone: {total_sections} sections removed across {files_touched} file(s).")


if __name__ == "__main__":
    main()
