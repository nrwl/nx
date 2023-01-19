import { hashFile } from '../index';

// TODO(cammisuli): write tests
describe('native', () => {
  it('should hash', () => {
    expect(hashFile).toBeDefined();
    // expect(hash('Test')).toMatchInlineSnapshot(`"12967476824633224542"`);
  });

  it('should create an instance of NativeHasher', () => {
    // const nativeHasher = new NativeFileHasher('/root');
    // expect(nativeHasher instanceof NativeFileHasher).toBe(true);
  });
});
