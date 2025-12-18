// Mock prettier to avoid loading the actual module.
// Prettier v3 uses dynamic imports which fail in Jest's VM environment.
jest.mock('prettier', () => ({
  format: jest.fn((code) => code),
  resolveConfig: jest.fn().mockResolvedValue({}),
  getFileInfo: jest
    .fn()
    .mockResolvedValue({ ignored: false, inferredParser: 'typescript' }),
  check: jest.fn().mockResolvedValue(true),
}));
