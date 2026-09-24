import { ZERO_STATS, type StepStats } from './types'

/** Mutable accumulator that hands out immutable snapshots for each trace step. */
export class StatsTracker {
  private stats: StepStats = { ...ZERO_STATS }

  addEdgeConsidered(count = 1): void {
    this.stats.edgesConsidered += count
    this.stats.totalOperations += count
  }

  addNodeVisited(count = 1): void {
    this.stats.nodesVisited += count
    this.stats.totalOperations += count
  }

  addComparisons(count: number): void {
    this.stats.comparisons += count
    this.stats.totalOperations += count
  }

  addPriorityQueueOps(count: number): void {
    this.stats.priorityQueueOps += count
    this.stats.totalOperations += count
  }

  addUnionFindOps(count: number): void {
    this.stats.unionFindOps += count
    this.stats.totalOperations += count
  }

  snapshot(): StepStats {
    return { ...this.stats }
  }
}
