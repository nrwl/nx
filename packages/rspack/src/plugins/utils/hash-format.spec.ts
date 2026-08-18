import { getOutputHashFormat } from './hash-format';

describe('getOutputHashFormat', () => {
  it.each(['all', 'bundles'])(
    "should hash chunks with [contenthash] (not [chunkhash]) for outputHashing '%s'",
    (option) => {
      const format = getOutputHashFormat(option);

      // chunk filenames must match the entry `filename` hash: [contenthash]
      // reflects module ids, [chunkhash] does not, leaving chunks stale (nx#36014).
      expect(format.chunk).toBe('.[contenthash:16]');
      expect(format.chunk).toBe(format.script);
    }
  );

  it("should not hash chunks for outputHashing 'none'", () => {
    expect(getOutputHashFormat('none').chunk).toBe('');
  });
});
