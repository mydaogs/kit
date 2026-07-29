export interface ChainCoordinates {
  blockNumber: bigint;
  logIndex: number;
}

/**
 * A watermark read back from storage.
 *
 * Both fields are independently nullable because that is what a database row
 * yields: a projection that has never been written has no coordinates, and a
 * row migrated in before the watermark existed can carry a block number with
 * no log index. Modelling this as `Partial<ChainCoordinates>` would force every
 * caller to launder `null` into `undefined` at the call site, for a distinction
 * the comparison below does not make.
 */
export interface StoredChainCoordinates {
  blockNumber?: bigint | null;
  logIndex?: number | null;
}

/**
 * Ordering guard for projections that overwrite a field.
 *
 * Logs can arrive out of order across a webhook delivery and a reconciler
 * sweep. Comparing `(blockNumber, logIndex)` against the watermark stored on
 * the row is what stops an older event from overwriting newer state.
 *
 * Absent coordinates admit the event: an unwritten projection has nothing to
 * supersede. A stored block number with no log index is treated as position
 * `-1` in its block, so the first event at that height still applies.
 */
export function isNewerChainEvent(
  incoming: ChainCoordinates,
  stored: StoredChainCoordinates | null | undefined,
): boolean {
  if (stored?.blockNumber === undefined || stored.blockNumber === null) {
    return true;
  }
  if (incoming.blockNumber !== stored.blockNumber) {
    return incoming.blockNumber > stored.blockNumber;
  }
  return incoming.logIndex > (stored.logIndex ?? -1);
}
