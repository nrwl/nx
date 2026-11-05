import { createHash } from 'crypto';
import { deriveRepoKey } from '../utils/workspace-id';
import { workspaceRoot } from '../utils/workspace-root';

const nxJson = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../config/nx-json', () => ({ readNxJson: () => nxJson.current }));
vi.mock('../utils/analytics-enabled', () => ({
  isAnalyticsEnabled: () => true,
}));
vi.mock('../utils/is-ci', () => ({ isCI: () => true }));
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => ({}) }));
vi.mock('../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerVersion: () => '10.0.0',
}));

// analytics.ts reads the binding through `require`, which vi.mock does not
// intercept, so patch the loaded module before analytics.ts captures it.
const native = require('../native');
const initializeTelemetry = vi.fn(() => 'session');
native.initializeTelemetry = initializeTelemetry;

let startAnalytics: typeof import('./analytics').startAnalytics;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('startAnalytics workspace id', () => {
  beforeAll(async () => {
    ({ startAnalytics } = await import('./analytics'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NX_ANALYTICS_SESSION_ID;
  });

  afterAll(() => {
    delete process.env.NX_ANALYTICS_SESSION_ID;
  });

  it.each([
    ['nxCloudId', { nxCloudId: 'cloud-id-123' }, 'cloud-id-123'],
    [
      'nxCloudAccessToken',
      { nxCloudAccessToken: 'access-token-456' },
      'access-token-456',
    ],
  ])('should report a digest of the %s', async (_, config, secret) => {
    nxJson.current = config;

    await startAnalytics();

    expect(initializeTelemetry).toHaveBeenCalledTimes(1);
    const [, workspaceId] = initializeTelemetry.mock.calls[0];
    expect(workspaceId).toEqual(sha256(secret));
    expect(JSON.stringify(initializeTelemetry.mock.calls)).not.toContain(
      secret
    );
  });

  it('should report the repo key unchanged', async () => {
    nxJson.current = {};

    await startAnalytics();

    const [, workspaceId] = initializeTelemetry.mock.calls[0];
    expect(workspaceId).toEqual(deriveRepoKey(workspaceRoot));
  });
});
