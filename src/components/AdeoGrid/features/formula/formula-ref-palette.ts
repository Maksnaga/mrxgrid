// @ts-nocheck — Port verbatim from Angular. Strict typing pending integration with useFormulaEngine (Phase 6b).
/**
 * Cyclic color palette used to highlight formula references inside the
 * editor + the grid. Colors are *not* hard-coded — the implementation
 * returns a CSS custom-property reference (`var(--moz-grid-ref-color-N)`),
 * letting consumers rebrand the palette from their own stylesheet without
 * a public component input.
 *
 * Assignment is *stable for the lifetime of an edit session*: the same
 * normalised ref text (e.g. `"A1"`, `"A1:B3"`) always receives the same
 * palette slot, so a cell keeps its colour while the user edits the
 * formula around it. The assignment resets when the editor closes.
 */

export const FORMULA_REF_PALETTE_SIZE = 8;

export class FormulaRefPalette {
  private readonly slots = new Map<string, number>();
  private nextSlot = 0;

  /** Returns a stable palette index (0..N-1) for the given ref key. */
  indexFor(key: string): number {
    let slot = this.slots.get(key);
    if (slot !== undefined) return slot;
    slot = this.nextSlot % FORMULA_REF_PALETTE_SIZE;
    this.slots.set(key, slot);
    this.nextSlot++;
    return slot;
  }

  clear(): void {
    this.slots.clear();
    this.nextSlot = 0;
  }
}

/** CSS custom-property reference for a given palette index. */
export function paletteColorVar(index: number): string {
  return `var(--moz-grid-ref-color-${index % FORMULA_REF_PALETTE_SIZE})`;
}