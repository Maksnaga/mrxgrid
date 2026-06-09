import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MozDrawerRef, MozDrawerFooterDirective, MozButtonComponent, DRAWER_DATA } from '@mozaic-ds/angular';

export interface FormulaReferenceEntry {
  readonly name: string;
  readonly signature: string;
  readonly summary: string;
}

export interface FormulaReferenceData {
  readonly entries: readonly FormulaReferenceEntry[];
}

interface FormulaReferenceGroup {
  readonly title: string;
  readonly entries: readonly FormulaReferenceEntry[];
}

const CATEGORY_ORDER = ['Math & stats', 'Logique', 'Texte', 'Autres'] as const;

const CATEGORY_MAP: Readonly<Record<string, (typeof CATEGORY_ORDER)[number]>> = {
  SUM: 'Math & stats',
  PRODUCT: 'Math & stats',
  AVERAGE: 'Math & stats',
  MIN: 'Math & stats',
  MAX: 'Math & stats',
  COUNT: 'Math & stats',
  COUNTA: 'Math & stats',
  ROUND: 'Math & stats',
  ABS: 'Math & stats',
  MOD: 'Math & stats',
  POWER: 'Math & stats',
  IF: 'Logique',
  AND: 'Logique',
  OR: 'Logique',
  NOT: 'Logique',
  IFERROR: 'Logique',
  IFS: 'Logique',
  CONCAT: 'Texte',
  LEN: 'Texte',
  LOWER: 'Texte',
  UPPER: 'Texte',
  TRIM: 'Texte',
  LEFT: 'Texte',
  RIGHT: 'Texte',
  MID: 'Texte',
  SUBSTITUTE: 'Texte',
};

@Component({
  selector: 'ad-grid-formula-reference-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MozButtonComponent, MozDrawerFooterDirective],
  templateUrl: './grid-formula-reference-drawer.html',
  styleUrls: ['./grid-formula-reference-drawer.scss'],
})
export class GridFormulaReferenceDrawerComponent {
  private readonly drawerRef = inject<MozDrawerRef<void>>(MozDrawerRef);
  private readonly data = inject<FormulaReferenceData>(DRAWER_DATA);

  readonly query = signal('');

  private readonly allGroups = computed<readonly FormulaReferenceGroup[]>(() => {
    const bucket = new Map<string, FormulaReferenceEntry[]>();
    for (const title of CATEGORY_ORDER) bucket.set(title, []);
    for (const entry of this.data.entries) {
      const category = CATEGORY_MAP[entry.name] ?? 'Autres';
      bucket.get(category)!.push(entry);
    }
    return CATEGORY_ORDER
      .map((title) => ({
        title,
        entries: (bucket.get(title) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.entries.length > 0);
  });

  readonly filteredGroups = computed<readonly FormulaReferenceGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.allGroups();
    return this.allGroups()
      .map((g) => ({
        title: g.title,
        entries: g.entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.signature.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.entries.length > 0);
  });

  readonly totalCount = computed(() => this.data.entries.length);
  readonly matchCount = computed(() =>
    this.filteredGroups().reduce((sum, g) => sum + g.entries.length, 0),
  );

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  close(): void {
    this.drawerRef.close();
  }
}
