/** Disjoint-set union-find with path compression and union by rank, used by Kruskal. */
export class UnionFind {
  private parent = new Map<string, string>()
  private rank = new Map<string, number>()
  operations = 0

  constructor(ids: Iterable<string>) {
    for (const id of ids) {
      this.parent.set(id, id)
      this.rank.set(id, 0)
    }
  }

  find(id: string): string {
    this.operations++
    let root = id
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!
    }
    let cur = id
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }

  /** Returns true if a union happened (the sets were distinct). */
  union(a: string, b: string): boolean {
    this.operations++
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return false
    const rankA = this.rank.get(rootA)!
    const rankB = this.rank.get(rootB)!
    if (rankA < rankB) {
      this.parent.set(rootA, rootB)
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA)
    } else {
      this.parent.set(rootB, rootA)
      this.rank.set(rootA, rankA + 1)
    }
    return true
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b)
  }
}
