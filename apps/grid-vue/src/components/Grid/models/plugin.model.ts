/**
 * Plugin API — Angular parity (ad-grid) §9.3.
 *
 * A plugin is an extension point that can read/write `GridState` and the
 * engines, register cleanup, and react to grid lifecycle. Use this when
 * you need to compose behaviour the core grid doesn't ship — e.g. a
 * server-side audit logger, a custom export format, a metrics emitter.
 *
 * Example:
 *
 *   function useAuditPlugin(): GridPlugin {
 *     return {
 *       name: 'audit',
 *       init(ctx) {
 *         const stop = watch(ctx.state.activeSorts, (s) => log('sort', s))
 *         return () => stop()  // cleanup
 *       },
 *     }
 *   }
 *
 *   <ad-grid-vue :plugins="[useAuditPlugin()]" />
 *
 * The `init` return value is the disposer — called when the grid unmounts
 * or the plugin is removed. May be omitted if the plugin needs no cleanup.
 */

import type { GridState } from '../state/useGridState'
import type { GridEngine } from '../engine/useGridEngine'
import type { RowData } from '../types'

export interface GridPluginContext<T extends RowData = RowData> {
  state: GridState<T>
  engine: GridEngine<T>
}

export interface GridPlugin<T extends RowData = RowData> {
  /** Stable plugin name — used for dedup + debugging. */
  name: string
  /** Called once on grid mount. Return a cleanup function or `void`. */
  init(ctx: GridPluginContext<T>): (() => void) | void
}
