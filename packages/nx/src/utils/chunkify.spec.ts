import { chunkify } from './chunkify';

describe('chunkify', () => {
  it('should wrap chunks at passed in size', () => {
    const files = ['aa', 'bb', 'cc', 'dd', 'ee'];
    expect(chunkify(files, 4)).toHaveLength(5);
    expect(chunkify(files, 7)).toHaveLength(3);
    expect(chunkify(files, 16)).toHaveLength(1);
  });

  it('should contain all items from target', () => {
    const files = ['aa', 'bb', 'cc', 'dd', 'ee'];
    expect(chunkify(files, 7).flat()).toHaveLength(5);
  });

  describe('measure', () => {
    // A caller that quotes or escapes after chunking makes every entry longer
    // than what was measured, which silently eats the headroom the budget
    // leaves for the rest of the command.
    const quoted = (item: string) => `"${item}"`.length;

    it('should size chunks against the measured length, not the raw one', () => {
      const files = ['aa', 'bb', 'cc', 'dd', 'ee'];

      // Raw: each entry costs 3 (2 + separator), so 7 fits two per chunk.
      expect(chunkify(files, 7)).toHaveLength(3);
      // Quoted: each costs 5, so only one fits.
      expect(chunkify(files, 7, quoted)).toHaveLength(5);
    });

    it('should still yield the raw items', () => {
      const files = ['aa', 'bb'];

      expect(chunkify(files, 7, quoted).flat()).toEqual(['aa', 'bb']);
    });

    it('should keep every chunk within budget once transformed', () => {
      const files = Array.from({ length: 200 }, (_, i) => `packages/p${i}.ts`);
      const budget = 100;

      for (const chunk of chunkify(files, budget, quoted)) {
        const spawned = chunk.map((f) => `"${f}"`).join(' ');
        expect(spawned.length).toBeLessThan(budget);
      }
    });
  });
});
