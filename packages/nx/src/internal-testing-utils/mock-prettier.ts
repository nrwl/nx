// Mock prettier to avoid loading the actual module.
// Prettier v3 uses dynamic imports, which fail in jest's VM environment -
// the reason the jest branch below needs this mock at all.
// Shared by this package's vitest suite AND other packages' jest suites, so
// it registers the mock through whichever runner is active. Each runner's
// transform only hoists its own literal call, so the branch not taken stays
// inert.
declare const vi: any;

if (typeof vi !== 'undefined') {
  vi.mock('prettier', () => ({
    format: vi.fn((code: string) => code),
    resolveConfig: vi.fn().mockResolvedValue({}),
    getFileInfo: vi
      .fn()
      .mockResolvedValue({ ignored: false, inferredParser: 'typescript' }),
    check: vi.fn().mockResolvedValue(true),
  }));
} else {
  jest.mock('prettier', () => ({
    format: jest.fn((code: string) => code),
    resolveConfig: jest.fn().mockResolvedValue({}),
    getFileInfo: jest
      .fn()
      .mockResolvedValue({ ignored: false, inferredParser: 'typescript' }),
    check: jest.fn().mockResolvedValue(true),
  }));
}
