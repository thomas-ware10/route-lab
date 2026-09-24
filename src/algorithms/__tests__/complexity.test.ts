import { describe, expect, it } from 'vitest'
import { algorithmIdsInFamily, algorithmsInSameFamily } from '../complexity'

describe('algorithm families', () => {
  it('groups dijkstra and astar as shortest-path', () => {
    expect(algorithmsInSameFamily('dijkstra', 'astar')).toBe(true)
    expect(algorithmIdsInFamily('shortest-path').sort()).toEqual(['astar', 'dijkstra'])
  })

  it('groups kruskal and prim as mst', () => {
    expect(algorithmsInSameFamily('kruskal', 'prim')).toBe(true)
    expect(algorithmIdsInFamily('mst').sort()).toEqual(['kruskal', 'prim'])
  })

  it('does not consider a shortest-path algorithm and an mst algorithm comparable', () => {
    expect(algorithmsInSameFamily('dijkstra', 'kruskal')).toBe(false)
    expect(algorithmsInSameFamily('astar', 'prim')).toBe(false)
  })

  it('an algorithm is always in the same family as itself', () => {
    expect(algorithmsInSameFamily('dijkstra', 'dijkstra')).toBe(true)
  })
})
