export interface ChainCoordinates {
  blockNumber: bigint;
  logIndex: number;
}

/**
 * Ordering guard for projections that overwrite a field.
 *
 * Logs can arrive out of order across a webhook delivery and a reconciler
 * sweep. Comparing `(blockNumber, logIndex)` against the watermark stored on
 * the row is what stops an older event from overwriting newer state.
 */
export function isNewerChainEvent(
  incoming: ChainCoordinates,
  stored: Partial<ChainCoordinates> | null | undefined,
): boolean {
  if (!stored || stored.blockNumber === undefined || stored.blockNumber === null) {
    return true;
  }
  if (incoming.blockNumber !== stored.blockNumber) {
    return incoming.blockNumber > stored.blockNumber;
  }
  return incoming.logIndex > (stored.logIndex ?? -1);
}
