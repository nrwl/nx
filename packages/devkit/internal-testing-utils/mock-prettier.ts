/**
 * Side-effect module: registers a jest mock of `prettier` (whose v3 dynamic
 * imports fail in Jest's VM) for specs that format output. It must remain a
 * dedicated subpath (not part of the internal-testing-utils barrel) because
 * importing it applies the mock — a barrel import would do so for every
 * consumer.
 */
type MockFn = {
  (...args: unknown[]): unknown;
  mockResolvedValue(value: unknown): MockFn;
};

declare const jest: {
  mock(moduleName: 'prettier', factory: () => unknown): void;
  fn(implementation?: (...args: unknown[]) => unknown): MockFn;
};

jest.mock('prettier', () => ({
  format: jest.fn((code) => code),
  resolveConfig: jest.fn().mockResolvedValue({}),
  getFileInfo: jest
    .fn()
    .mockResolvedValue({ ignored: false, inferredParser: 'typescript' }),
  check: jest.fn().mockResolvedValue(true),
}));

export {};
