import {
  MockInstance,
  afterEach,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from 'vitest';

/**
 * Mocks the fs and fs/promises modules with memfs.
 */
type Memfs = typeof import('memfs');
export const MEMFS_VOLUME = '/memfs';

vi.mock('fs', async () => {
  const memfs: Memfs = await vi.importActual('memfs');
  return memfs.fs;
});

vi.mock('fs/promises', async () => {
  const memfs: Memfs = await vi.importActual('memfs');
  return memfs.fs.promises;
});

/**
 * Mocks the current working directory to MEMFS_VOLUME.
 * This is useful when you use relative paths in your code
 * @type {MockInstance<[], string>}
 *
 * @example
 * - `readFile('./file.txt')` reads MEMFS_VOLUME/file.txt
 * - `readFile(join(process.cwd(), 'file.txt'))` reads MEMFS_VOLUME/file.txt
 * - `readFile('file.txt')` reads file.txt
 */
let cwdSpy: MockInstance;

// This covers arrange blocks at the top of a "describe" block
beforeAll(() => {
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(MEMFS_VOLUME);
});

// Clear mock usage data in arrange blocks as well as usage of the API in each "it" block.
// docs: https://vitest.dev/api/mock.html#mockclear
beforeEach(() => {
  cwdSpy.mockClear();
});

// Restore mock implementation and usage data "it" block
// Mock implementations remain if given. => vi.fn(impl).mockRestore() === vi.fn(impl)
// docs: https://vitest.dev/api/mock.html#mockrestore
afterEach(() => {
  cwdSpy.mockRestore();
});

// Restore the original implementation after all "describe" block in a file
// docs: https://vitest.dev/api/mock.html#mockreset
afterAll(() => {
  cwdSpy.mockReset();
});
