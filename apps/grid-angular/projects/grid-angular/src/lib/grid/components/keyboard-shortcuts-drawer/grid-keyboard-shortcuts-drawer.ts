import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MozDrawerRef, MozDrawerFooterDirective, MozButtonComponent } from '@mozaic-ds/angular';

interface ShortcutItem {
  keys: string;
  label: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

interface RenderedItem {
  keys: string;
  parts: string[];
  label: string;
}

interface RenderedGroup {
  title: string;
  items: RenderedItem[];
}

const EXCEL_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    items: [
      { keys: '← ↑ → ↓', label: 'Déplacer la cellule active' },
      { keys: 'Ctrl + Flèche', label: 'Sauter au bord du bloc de données' },
      { keys: 'Home / End', label: 'Début / fin de la ligne' },
      { keys: 'Ctrl + Home / End', label: 'Première / dernière cellule' },
      { keys: 'PageUp / PageDown', label: 'Page précédente / suivante' },
      { keys: 'Tab / Shift+Tab', label: 'Cellule suivante / précédente' },
      { keys: 'Enter / Shift+Enter', label: 'Descendre / remonter' },
    ],
  },
  {
    title: 'Sélection',
    items: [
      { keys: 'Shift + Flèche', label: 'Étendre la plage' },
      { keys: 'Shift + Ctrl + Flèche', label: "Étendre jusqu'au bord du bloc" },
      { keys: 'Shift + Home / End', label: 'Étendre au début / fin de la ligne' },
      { keys: 'Shift + Ctrl + Home / End', label: 'Étendre au début / fin du tableau' },
      { keys: 'Shift + PageUp / Down', label: "Étendre d'une page" },
      { keys: 'Ctrl + A', label: 'Sélectionner tout' },
      { keys: 'Shift + Espace', label: 'Sélectionner la ligne' },
      { keys: 'Ctrl + Espace', label: 'Sélectionner la colonne' },
    ],
  },
  {
    title: 'Édition',
    items: [
      { keys: 'Enter / F2', label: 'Entrer en édition' },
      { keys: 'Touche imprimable', label: 'Typing-to-edit (remplace la valeur)' },
      { keys: 'Escape', label: "Annuler l'édition" },
      { keys: 'Enter', label: 'Valider + descendre' },
      { keys: 'Tab / Shift+Tab', label: 'Valider + droite / gauche' },
      { keys: 'Alt + Enter', label: 'Retour à la ligne (texte)' },
      { keys: 'Ctrl + Enter', label: 'Valider + remplir la sélection' },
      { keys: 'Backspace / Delete', label: 'Effacer les cellules sélectionnées' },
    ],
  },
  {
    title: 'Presse-papier',
    items: [
      { keys: 'Ctrl + C', label: 'Copier (TSV)' },
      { keys: 'Ctrl + X', label: 'Couper (marching ants)' },
      { keys: 'Ctrl + V', label: 'Coller (déplace après Ctrl+X)' },
      { keys: 'Ctrl + D', label: 'Remplir vers le bas (fill down)' },
      { keys: 'Ctrl + R', label: 'Remplir vers la droite (fill right)' },
    ],
  },
  {
    title: 'Historique',
    items: [
      { keys: 'Ctrl + Z', label: 'Annuler (undo)' },
      { keys: 'Ctrl + Y', label: 'Rétablir (redo)' },
      { keys: 'Ctrl + Shift + Z', label: 'Rétablir (redo, alt.)' },
    ],
  },
];

@Component({
  selector: 'ad-grid-keyboard-shortcuts-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MozButtonComponent, MozDrawerFooterDirective],
  templateUrl: './grid-keyboard-shortcuts-drawer.html',
  styleUrls: ['./grid-keyboard-shortcuts-drawer.scss'],
})
export class GridKeyboardShortcutsDrawerComponent {
  private readonly drawerRef = inject<MozDrawerRef<void>>(MozDrawerRef);

  readonly groups: RenderedGroup[] = EXCEL_SHORTCUTS.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
      keys: item.keys,
      label: item.label,
      parts: item.keys.split(' '),
    })),
  }));

  close(): void {
    this.drawerRef.close();
  }
}
