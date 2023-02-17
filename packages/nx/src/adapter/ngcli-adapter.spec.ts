import { arrayBufferToString } from './ngcli-adapter';

describe('ngcli-adapter', () => {
  it('arrayBufferToString should support large buffers', () => {
    const largeString = 'a'.repeat(1000000);

    const result = arrayBufferToString(Buffer.from(largeString));

    expect(result).toBe(largeString);
  });
});
