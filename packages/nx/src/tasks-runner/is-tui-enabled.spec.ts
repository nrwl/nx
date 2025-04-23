describe('isTuiEnabled', () => {
  let originalTuiEnv: string | undefined;
  let originalCIEnv: string | undefined;
  let isTuiEnabled: typeof import('./is-tui-enabled').isTuiEnabled;
  beforeEach(async () => {
    jest.resetModules();
    isTuiEnabled = await import('./is-tui-enabled').then((m) => m.isTuiEnabled);
    originalTuiEnv = process.env.NX_TUI;
    originalCIEnv = process.env.CI;
    process.env.CI = 'false';
    delete process.env.NX_TUI;
  });

  afterEach(() => {
    if (originalTuiEnv) {
      process.env.NX_TUI = originalTuiEnv;
    } else {
      delete process.env.NX_TUI;
    }
    if (originalCIEnv) {
      process.env.CI = originalCIEnv;
    } else {
      delete process.env.CI;
    }
  });

  it('should return true by default', () => {
    // default  is false  in nx.json
    expect(isTuiEnabled({}, true)).toBe(true);
  });

  it('should return true if the TUI is enabled', () => {
    process.env.NX_TUI = 'true';
    expect(isTuiEnabled({}, true)).toBe(true);
  });

  it('should return false if the TUI is disabled', () => {
    process.env.NX_TUI = 'false';
    expect(isTuiEnabled({}, true)).toBe(false);
  });

  it('should return false in CI', () => {
    process.env.CI = 'true';
    expect(isTuiEnabled({}, true)).toBe(false);
  });

  it('should return true if TUI is enabled in CI', () => {
    process.env.NX_TUI = 'true';
    process.env.CI = 'true';
    expect(isTuiEnabled({}, true)).toBe(true);
  });

  it('should return true if the TUI is enabled in nx.json', () => {
    expect(isTuiEnabled({ tui: { enabled: true } }, true)).toBe(true);
  });

  it('should return false if the TUI is disabled in nx.json', () => {
    expect(isTuiEnabled({ tui: { enabled: false } }, true)).toBe(false);
  });
});
