#!/usr/bin/env python3
"""
Fix ASCII box-drawing diagrams in Markdown docs.

After bulk renames (<Grid> -> <ad-grid-vue>, <moz-grid> -> <ad-grid-angular>, etc.),
many content lines inside ┌─┐│└┘ boxes became longer than the box width, breaking
the right-edge `│` alignment.

Strategy per fenced code block:
  - find box top-borders (┌────┐), record indent + left-`│` column
  - walk down to matching bottom border (└────┘) at same indent
  - for each content line, normalize the right-`│` to box right column
  - if any content overflows, *widen* the entire box (top, bottom, and all content
    right-`│` cols) so every right-`│` aligns at the new max column
  - handle nested boxes recursively: a content line may itself open
    sub-boxes (`│  ┌─┐  │`) whose own right-`│` should align inside the
    outer box.

Constraints:
  - never alter the visible content text — only adjust trailing whitespace inside walls
  - don't touch code blocks without box-drawing chars
  - don't touch markdown tables (uses ASCII `|`, not `│`)
"""

from __future__ import annotations

import os
import sys
from typing import List, Optional, Tuple

BOX_CHARS = set("┌┐└┘─│├┤┬┴┼")
TOP_LEFT = "┌"
TOP_RIGHT = "┐"
BOT_LEFT = "└"
BOT_RIGHT = "┘"
VBAR = "│"
HBAR = "─"


def find_fenced_blocks(lines: List[str]) -> List[Tuple[int, int]]:
    """Return list of (start_line_idx, end_line_idx) for fenced ``` blocks (inclusive of fences)."""
    blocks: List[Tuple[int, int]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()
        if stripped.startswith("```"):
            start = i
            j = i + 1
            while j < len(lines):
                if lines[j].lstrip().startswith("```"):
                    break
                j += 1
            blocks.append((start, j))
            i = j + 1
        else:
            i += 1
    return blocks


def block_has_box_chars(lines: List[str], start: int, end: int) -> bool:
    for i in range(start + 1, min(end, len(lines))):
        if any(ch in BOX_CHARS for ch in lines[i]):
            return True
    return False


def _rfind_vbar_before(s: str, max_col: Optional[int]) -> int:
    """Return rightmost `│` position strictly < max_col (or rightmost if max_col is None)."""
    if max_col is None:
        return s.rfind(VBAR)
    return s.rfind(VBAR, 0, max_col)


def fix_box_at(lines: List[str], top_idx: int, indent: int, left_col: int,
               block_end: int, max_right_col: Optional[int] = None) -> int:
    """
    Process the box whose top border is at lines[top_idx] with the given indent
    and left-`│` column. Returns the index of the bottom border line, or top_idx
    if no matching bottom border found.

    `max_right_col`: if set, the right `│` of this box (and its contents) must
    be strictly before this column. Used when recursing into a nested box so
    we don't pick up the parent box's right `│` as ours.

    Mutates `lines` in place.
    """
    top = lines[top_idx]
    # Determine current top-right `┐` column
    top_right = top.find(TOP_RIGHT, left_col)
    if top_right < 0:
        return top_idx
    if max_right_col is not None and top_right >= max_right_col:
        # parent box constraint says we can't be that wide — abort
        return top_idx

    # First pass: find bottom border + measure max needed right column
    # The bottom border must be at same indent + start with └ at left_col
    bot_idx = -1
    for k in range(top_idx + 1, block_end):
        l = lines[k]
        # bottom border: starts with `└` at left_col after `indent` spaces
        if len(l) > left_col and l[left_col] == BOT_LEFT:
            # confirm it's a bottom border (mostly ─ chars and ends with ┘)
            # bounded by max_right_col so we don't pick up parent's border
            bot_right_search_end = max_right_col if max_right_col is not None else len(l)
            bot_right = l.find(BOT_RIGHT, left_col, bot_right_search_end)
            if bot_right > left_col:
                # check the slice between is all ─ (or ┴/┬)
                between = l[left_col + 1:bot_right]
                if all(c in HBAR + "┴┬┼" for c in between):
                    bot_idx = k
                    break
        # If we hit another top border at same left_col before finding bottom,
        # this is a "stacked" box (separate adjacent boxes). Stop.
        if len(l) > left_col and l[left_col] == TOP_LEFT and k != top_idx:
            # only stop if it looks like a different top border (mostly ─)
            tr2 = l.find(TOP_RIGHT, left_col)
            if tr2 > left_col:
                between = l[left_col + 1:tr2]
                if all(c in HBAR + "┴┬┼" for c in between):
                    break

    if bot_idx < 0:
        return top_idx

    # Measure: for each content line between top and bot, what's the minimum
    # right column needed to fit all content (excluding the right `│` itself)?
    # A content line of this box has `│` at left_col and a `│` at some col >= top_right.
    # We want to set the right `│` at max(top_right, max(content_min_right_col)).
    content_indices = list(range(top_idx + 1, bot_idx))
    needed_right = top_right

    # First, fix nested boxes (recursively) so their content is final before
    # we measure outer-box width.
    # A nested box opens at a content line where there's `┌` after left_col+1.
    # Pass max_right_col = current top_right so the nested box can't bleed past our right `│`.
    nested_bound = top_right  # nested box's right `│` must be strictly < top_right
    k = top_idx + 1
    while k < bot_idx:
        l = lines[k]
        # find first `┌` after left_col (and strictly before nested_bound)
        inner_top = l.find(TOP_LEFT, left_col + 1, nested_bound)
        if inner_top > left_col:
            # check it's a top-border-style char (followed by ─ chars then ┐)
            inner_tr = l.find(TOP_RIGHT, inner_top, nested_bound)
            if inner_tr > inner_top:
                between = l[inner_top + 1:inner_tr]
                if all(c in HBAR + "┴┬┼" for c in between):
                    # recurse into nested box; bound by our right `│` column
                    inner_bot = fix_box_at(lines, k, indent + (inner_top - left_col),
                                            inner_top, bot_idx,
                                            max_right_col=nested_bound)
                    # nested box processed; advance past its bottom
                    if inner_bot > k:
                        k = inner_bot + 1
                        continue
        k += 1

    # Now measure required right column for each content line (post nested-fix).
    # The "content" extends from left_col+1 to our box's right `│` position.
    for k in content_indices:
        l = lines[k]
        if len(l) <= left_col or l[left_col] != VBAR:
            # Not a content line of this box (could be a separator inside).
            # But still measure if it has a `│` somewhere starting at left_col
            continue
        # find our box's right `│` — strictly before max_right_col if set,
        # else rightmost on line
        right_v = _rfind_vbar_before(l, max_right_col)
        if right_v <= left_col:
            continue
        # the minimum right col needed = position of last non-space char before/at right_v
        between = l[left_col + 1:right_v]
        # Find the rightmost non-space character in `between`
        stripped_right = between.rstrip()
        content_end_offset = len(stripped_right)
        original_trailing = len(between) - len(stripped_right)
        # minimum pad: if original had >=1 trailing space, keep at least 1
        min_pad = 1 if original_trailing >= 1 else 0
        needed = left_col + 1 + content_end_offset + min_pad
        if needed > needed_right:
            needed_right = needed

    # If we need to widen, rewrite top border and bottom border
    if needed_right != top_right:
        # Rewrite top: indent spaces + `┌` + (needed_right - left_col - 1) `─` + `┐` + rest after ┐
        new_top = (top[:left_col] + TOP_LEFT
                   + HBAR * (needed_right - left_col - 1)
                   + TOP_RIGHT + top[top_right + 1:])
        lines[top_idx] = new_top

        bot = lines[bot_idx]
        bot_right = bot.find(BOT_RIGHT, left_col)
        # preserve any junction chars (┴┬┼) in the bottom border at their current positions
        old_between = bot[left_col + 1:bot_right]
        # Build new between: keep junctions roughly proportional or just use ─.
        # Simplest: stretch with ─, but try to preserve junctions if present.
        if any(c in "┴┬┼" for c in old_between):
            # Preserve junction positions proportionally
            new_between_len = needed_right - left_col - 1
            new_between = list(HBAR * new_between_len)
            # Place junctions proportionally
            old_len = len(old_between)
            for i, c in enumerate(old_between):
                if c in "┴┬┼" and old_len > 0:
                    new_pos = int(round(i * new_between_len / max(old_len, 1)))
                    new_pos = max(0, min(new_pos, new_between_len - 1))
                    new_between[new_pos] = c
            new_bot = (bot[:left_col] + BOT_LEFT + "".join(new_between)
                       + BOT_RIGHT + bot[bot_right + 1:])
        else:
            new_bot = (bot[:left_col] + BOT_LEFT
                       + HBAR * (needed_right - left_col - 1)
                       + BOT_RIGHT + bot[bot_right + 1:])
        lines[bot_idx] = new_bot

    # Now repad every content line so its right `│` lands at needed_right
    for k in content_indices:
        l = lines[k]
        if len(l) <= left_col:
            continue
        ch = l[left_col]
        # `├──┤` inner separator row: rewrite as a full-width separator
        if ch == "├":
            # find ┤ on this line (bounded by max_right_col)
            search_end = max_right_col if max_right_col is not None else len(l)
            right_t = l.find("┤", left_col, search_end)
            if right_t > left_col:
                between = l[left_col + 1:right_t]
                if all(c in HBAR + "┴┬┼" for c in between):
                    # rewrite to span left_col..needed_right
                    new_between = HBAR * (needed_right - left_col - 1)
                    new_line = (l[:left_col] + "├" + new_between + "┤"
                                + l[right_t + 1:])
                    lines[k] = new_line
                    continue
        if ch != VBAR:
            continue
        right_v = _rfind_vbar_before(l, max_right_col)
        if right_v <= left_col:
            continue
        between = l[left_col + 1:right_v]
        stripped_right = between.rstrip()
        # how many spaces to pad after stripped_right so that right `│` lands at needed_right
        target_between_len = needed_right - left_col - 1
        if target_between_len < len(stripped_right):
            # content is longer than box; this shouldn't happen since we widened, but guard
            new_between = stripped_right
        else:
            pad = target_between_len - len(stripped_right)
            new_between = stripped_right + (" " * pad)
        # preserve anything after the right `│` (rare; e.g. trailing arrow `── ▶`)
        new_line = l[:left_col + 1] + new_between + VBAR + l[right_v + 1:]
        lines[k] = new_line

    return bot_idx


def process_block(lines: List[str], start: int, end: int) -> None:
    """Process one fenced code block (start..end exclusive of fences)."""
    # Walk content lines, find top borders, process boxes.
    i = start + 1
    while i < end:
        l = lines[i]
        # find first `┌` on the line
        tl = l.find(TOP_LEFT)
        if tl >= 0:
            # confirm top border (between tl and matching ┐ is mostly ─)
            tr = l.find(TOP_RIGHT, tl)
            if tr > tl:
                between = l[tl + 1:tr]
                if all(c in HBAR + "┴┬┼" for c in between):
                    # process this box
                    indent = tl  # number of leading chars before `┌`
                    bot_idx = fix_box_at(lines, i, indent, tl, end)
                    if bot_idx > i:
                        i = bot_idx + 1
                        continue
        i += 1


def process_file(path: str) -> Tuple[int, int]:
    """Process file; return (n_blocks_with_boxes, n_lines_changed)."""
    with open(path, "r", encoding="utf-8") as f:
        original_content = f.read()
    lines = original_content.split("\n")
    # Note: split + join roundtrip preserves trailing newline as empty final element

    blocks = find_fenced_blocks(lines)
    n_box_blocks = 0
    before_snapshot = list(lines)
    for (s, e) in blocks:
        if block_has_box_chars(lines, s, e):
            n_box_blocks += 1
            process_block(lines, s, e)

    changed_lines = sum(1 for a, b in zip(before_snapshot, lines) if a != b)

    new_content = "\n".join(lines)
    if new_content != original_content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
    return n_box_blocks, changed_lines


FILES = [
    "packages/docs/grid-spec/00-introduction.md",
    "packages/docs/grid-spec/B-sort-filter-group-pagination.md",
    "packages/docs/portal/architecture.md",
    "packages/docs/portal/guide/01-introduction.md",
    "packages/docs/portal/guide/03-architecture.md",
    "packages/docs/portal/guide/04-state-engine.md",
    "packages/docs/portal/guide/05-virtualization.md",
    "packages/docs/portal/guide/06-data-pipeline.md",
    "packages/docs/portal/tutorial/06-edition-persistance.md",
    "packages/docs/portal/tutorial/07-bulk-actions-selection.md",
    "apps/grid-angular/projects/grid-angular/src/lib/grid/docs/ARCHITECTURE.md",
    "apps/grid-angular/projects/grid-angular/src/lib/grid/docs/New_Feature_help.md",
]


def main() -> int:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    total_blocks = 0
    total_changes = 0
    for rel in FILES:
        path = os.path.join(repo_root, rel)
        if not os.path.exists(path):
            print(f"SKIP (missing): {rel}")
            continue
        nb, nc = process_file(path)
        total_blocks += nb
        total_changes += nc
        print(f"{rel}: {nb} box-block(s), {nc} line(s) changed")
    print(f"\nTotal: {total_blocks} blocks, {total_changes} lines changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
