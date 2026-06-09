#!/usr/bin/env bash
# migrate-mozaic-imports.sh
# Transforms relative Mozaic component imports inside apps/grid-angular
# to the published '@mozaic-ds/angular' package import path.
#
# Run from the monorepo root:
#   bash tools/migrate-mozaic-imports.sh
#
# After running, verify no external relative imports remain:
#   grep -rEn "from '(\.\.\/){2,}[^.]" apps/grid-angular/projects/grid-angular/src/lib/grid --include='*.ts'
set -euo pipefail

GRID_DIR="apps/grid-angular/projects/grid-angular/src/lib/grid"
TARGET="'@mozaic-ds/angular'"

# All external (non-grid-internal) relative import patterns found via audit.
# 3-deep patterns (../../../)
PATTERNS_3=(
  "../../../action-listbox/action-listbox"
  "../../../action-listbox/directive/action-listbox-trigger.directive"
  "../../../action-listbox/model/action-listbox.model"
  "../../../button/button"
  "../../../checkbox/checkbox"
  "../../../datepicker/datepicker"
  "../../../drawer/config/drawer.config"
  "../../../drawer/directive/drawer-footer.directive"
  "../../../drawer/ref/drawer-ref"
  "../../../loader"
  "../../../pagination/pagination"
  "../../../select/select"
  "../../../toggle/toggle"
  "../../../tooltip/tooltip.directive"
)

# 2-deep patterns (../../) that point OUTSIDE the grid (not internal grid paths)
PATTERNS_2=(
  "../../button/button"
  "../../combobox"
  "../../combobox/combobox.model"
  "../../select"
)

do_replace() {
  local old_path="$1"
  local old_quoted="'${old_path}'"
  local escaped_old
  escaped_old=$(printf '%s\n' "$old_path" | sed 's|/|\\/|g; s|\.|\\.|g')

  echo "  Replacing: $old_quoted -> $TARGET"

  # Use find + sed for portability (BSD sed on macOS needs -i '')
  find "$GRID_DIR" -type f \( -name '*.ts' -o -name '*.html' \) -print0 \
    | xargs -0 grep -l "'${old_path}'" 2>/dev/null \
    | while IFS= read -r file; do
        sed -i.bak "s|'${escaped_old}'|${TARGET}|g" "$file"
        rm -f "${file}.bak"
      done
}

echo "=== migrate-mozaic-imports.sh ==="
echo "Grid dir: $GRID_DIR"
echo ""

echo "--- 3-deep patterns ---"
for p in "${PATTERNS_3[@]}"; do
  do_replace "$p"
done

echo "--- 2-deep external patterns ---"
for p in "${PATTERNS_2[@]}"; do
  do_replace "$p"
done

echo ""
echo "Done. Residual external imports (should be 0):"
grep -rEn "from '(\.\.\/){2,}[^.]" "$GRID_DIR" --include='*.ts' --include='*.html' 2>/dev/null \
  | grep -vE "from '\.\./\.\./state|from '\.\./\.\./models|from '\.\./\.\./engine|from '\.\./\.\./features|from '\.\./\.\./directives|from '\.\./\.\./components|from '\.\./\.\./utils" \
  || echo "  (none — all clean)"
