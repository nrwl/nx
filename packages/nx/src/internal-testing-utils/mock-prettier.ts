// Mock prettier to avoid loading the actual module.
// Prettier v3 uses dynamic imports which fail in Jest's VM environment.
vi.mock('prettier', () => ({
  format: vi.fn((code) => code),
  resolveConfig: vi.fn().mockResolvedValue({}),
  getFileInfo: vi
    .fn()
    .mockResolvedValue({ ignored: false, inferredParser: 'typescript' }),
  check: vi.fn().mockResolvedValue(true),
}));
