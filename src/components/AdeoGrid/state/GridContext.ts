/**
 * GridContext — Vue equivalent of the Angular `inject(GridStateManager)` pattern.
 *
 * `GRID_STATE_KEY` is the canonical InjectionKey provided once per `<AdeoGrid>`
 * instance. `useGridContext()` is the consumer-facing typed inject helper that
 * throws (rather than returning `undefined`) when called outside the grid —
 * matching the Angular semantics where DI failure is a hard error.
 *
 * The shape of the injected value is the `GridState` returned by
 * `state/useGridState.ts`. We re-export the key here (separately from the
 * factory) so subcomponents can `import { GRID_STATE_KEY } from './state/GridContext'`
 * without pulling in the factory itself, keeping import graphs tight.
 */

import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { GridState } from './useGridState'
import type { RowData } from '../types'

export const GRID_STATE_KEY: InjectionKey<GridState<RowData>> = Symbol('AdeoGridState')

/**
 * Type-safe inject helper. Throws when called outside a `<AdeoGrid>` — failing
 * loud beats silently producing bad render output for a context that should be
 * unconditionally present.
 */
export function useGridContext<T = RowData>(): GridState<T> {
  const state = inject(GRID_STATE_KEY)
  if (!state) {
    throw new Error(
      '[adeo-grid] useGridContext() must be called inside a <AdeoGrid> component',
    )
  }
  return state as unknown as GridState<T>
}
