import { SortDirection } from './column.model';

export interface SortDef {
  field: string;
  direction: SortDirection;
  priority: number;
}

export interface SortEvent {
  sorts: SortDef[];
}
