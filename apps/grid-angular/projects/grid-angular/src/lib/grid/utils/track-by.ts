import { DisplayRow } from '../models/display-row.model';

export function trackDisplayRow<T>(_index: number, row: DisplayRow<T>): string {
  if (row.type === 'group') {
    return `group:${row.group.groupKey}`;
  }
  return `data:${row.index}`;
}

export function trackByField(_index: number, col: { field: string }): string {
  return col.field;
}
