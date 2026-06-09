import { GridStateManager } from '../state/grid-state';
import { GridEngine } from '../engine/grid-engine';

export interface GridPlugin<T = unknown> {
  name: string;
  /**
   * Called once when the grid initialises. Receives a context object containing
   * the state manager and the grid engine. May return a disposer function that
   * will be called on `ngOnDestroy` — replacing the previous `destroy()` method.
   */
  init(ctx: { state: GridStateManager<T>; engine: GridEngine<T> }): (() => void) | void;
}
