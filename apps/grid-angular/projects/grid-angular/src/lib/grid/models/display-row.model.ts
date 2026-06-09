export interface GroupRow<T = unknown> {
  type: 'group';
  field: string;
  value: unknown;
  displayValue: string;
  depth: number;
  count: number;
  expanded: boolean;
  groupKey: string;
  children: (GroupRow<T> | T)[];
  parent: GroupRow<T> | null;
}

export type DisplayRow<T = unknown> =
  | { type: 'data'; data: T; index: number; depth: number }
  | { type: 'group'; group: GroupRow<T> }
  | { type: 'detail'; data: T; index: number };
