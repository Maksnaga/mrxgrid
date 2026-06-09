import { Directive, TemplateRef, inject, input } from '@angular/core';

export type GridToolbarSlot = 'start' | 'end';

@Directive({
  selector: '[mozGridToolbarDef]',
})
export class AdeoGridToolbarDef {
  readonly slot = input<GridToolbarSlot>('end', { alias: 'mozGridToolbarDef' });
  readonly template = inject(TemplateRef);
}
