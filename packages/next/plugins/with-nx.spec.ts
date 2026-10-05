import { withNx } from './with-nx';

describe('removed withNx stub', () => {
  // Nx sets this when it runs the spec; the warning only fires once per process.
  const target = process.env.NX_TASK_TARGET_TARGET;
  beforeEach(() => delete process.env.NX_TASK_TARGET_TARGET);
  afterEach(() => {
    if (target === undefined) delete process.env.NX_TASK_TARGET_TARGET;
    else process.env.NX_TASK_TARGET_TARGET = target;
  });

  it('keeps the async config shape without reading an Nx graph or changing options', async () => {
    const config = Object.freeze({
      distDir: 'custom',
      env: { marker: 'preserved' },
    });
    for (const phase of [
      'phase-development-server',
      'phase-production-build',
      'phase-production-server',
    ]) {
      expect(await withNx(config)(phase, {})).toBe(config);
    }
  });

  it('supports both generated CommonJS import forms', async () => {
    const legacy = require('./with-nx');
    expect(legacy).toBe(legacy.withNx);
    const config = { distDir: 'custom' };
    expect(await legacy(config)('phase-production-server', {})).toBe(config);
  });

  it('warns during Nx task runs but not on production server start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NX_TASK_TARGET_TARGET = 'build';
    try {
      await withNx({})('phase-production-server', {});
      expect(warn).not.toHaveBeenCalled();
      await withNx({})('phase-production-build', {});
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('`withNx()` from `@nx/next` was removed')
      );
    } finally {
      warn.mockRestore();
    }
  });
});
