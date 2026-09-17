const mocks = vi.hoisted(() => ({
  canObserveModuleClosure: vi.fn(() => true),
}));

vi.mock('./isolation/module-closure', async () => ({
  ...(await vi.importActual('./isolation/module-closure')),
  canObserveModuleClosure: mocks.canObserveModuleClosure,
}));

import { capabilityCacheDisabledReason } from './get-plugins';
import { resetIsolationFallbackForTesting } from './isolation/fallback';

describe('capabilityCacheDisabledReason', () => {
  beforeEach(() => {
    mocks.canObserveModuleClosure.mockReturnValue(true);
    resetIsolationFallbackForTesting();
    delete process.env.NX_ISOLATE_PLUGINS;
  });

  afterEach(() => {
    delete process.env.NX_ISOLATE_PLUGINS;
    resetIsolationFallbackForTesting();
  });

  it('says nothing when the cache is on', () => {
    expect(capabilityCacheDisabledReason()).toBeNull();
  });

  it('names the runtime when it cannot report a module closure', () => {
    mocks.canObserveModuleClosure.mockReturnValue(false);

    expect(capabilityCacheDisabledReason()).toContain('Node');
  });

  it('names isolation when it is turned off', () => {
    process.env.NX_ISOLATE_PLUGINS = 'false';

    // `nx report` is where someone asks why this changed nothing for them, and
    // a Node version would send them to upgrade a runtime that was never the
    // reason.
    expect(capabilityCacheDisabledReason()).toContain('isolation');
  });
});
