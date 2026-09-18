import { withNx } from './with-nx';

describe('removed withNx stub', () => {
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
});
