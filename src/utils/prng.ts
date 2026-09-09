export class PRNG {
  private state: number

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let h = 2166136261

      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
      }

      this.state = h >>> 0
    } else {
      this.state = seed >>> 0 || 1337
    }
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  public choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  public chance(probability: number): boolean {
    return this.next() < probability
  }
}
