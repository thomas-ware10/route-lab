/**
 * Binary min-heap keyed by an explicit priority. Used by Dijkstra, A*, and
 * Prim so their step traces can report real push/pop counts and comparisons
 * rather than an approximation.
 */
export class PriorityQueue<T> {
  private heap: { item: T; priority: number }[] = []
  comparisons = 0
  operations = 0

  get size(): number {
    return this.heap.length
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  push(item: T, priority: number): void {
    this.operations++
    this.heap.push({ item, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): { item: T; priority: number } | undefined {
    if (this.heap.length === 0) return undefined
    this.operations++
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }
    return top
  }

  private bubbleUp(index: number): void {
    let i = index
    while (i > 0) {
      const parent = (i - 1) >> 1
      this.comparisons++
      if (this.heap[parent].priority <= this.heap[i].priority) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private bubbleDown(index: number): void {
    let i = index
    const n = this.heap.length
    for (;;) {
      const left = 2 * i + 1
      const right = 2 * i + 2
      let smallest = i
      if (left < n) {
        this.comparisons++
        if (this.heap[left].priority < this.heap[smallest].priority) smallest = left
      }
      if (right < n) {
        this.comparisons++
        if (this.heap[right].priority < this.heap[smallest].priority) smallest = right
      }
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}
