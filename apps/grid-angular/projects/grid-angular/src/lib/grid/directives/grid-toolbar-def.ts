import { Directive, TemplateRef, inject, input } from '@angular/core';

export type GridToolbarSlot = 'start' | 'end';

@Directive({
  selector: '[adGridToolbarDef]',
})
export class AdeoGridToolbarDef {
  readonly slot = input<GridToolbarSlot>('end', { alias: 'adGridToolbarDef' });
  readonly template = inject(TemplateRef);
}
