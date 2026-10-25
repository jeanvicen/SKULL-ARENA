/**
 * Object pool sem alocação no caminho quente. Itens ativos ficam compactados
 * no início de `items` (swap-remove), então iterar é um for simples até `count`.
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;
  constructor(private readonly factory: () => T, prealloc = 0) {
    for (let i = 0; i < prealloc; i++) this.items.push(factory());
  }
  /** Pega um item (reutilizado se possível). Quem chama deve reinicializar os campos. */
  acquire(): T {
    if (this.count === this.items.length) this.items.push(this.factory());
    return this.items[this.count++];
  }
  /** Libera o item do índice i (troca com o último ativo). */
  releaseAt(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const tmp = this.items[i];
      this.items[i] = this.items[last];
      this.items[last] = tmp;
    }
  }
  clear(): void {
    this.count = 0;
  }
  get capacity(): number {
    return this.items.length;
  }
}
