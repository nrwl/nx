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
});
