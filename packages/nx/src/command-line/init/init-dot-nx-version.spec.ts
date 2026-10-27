const mockGenerateDotNxSetup = vi.fn();
vi.mock('./implementation/dot-nx/add-nx-scripts', () => ({
  generateDotNxSetup: (...args: unknown[]) => mockGenerateDotNxSetup(...args),
}));

const mockResolveVersionWithProvenance = vi.fn();
vi.mock('../../utils/provenance', async () => ({
  ...(await vi.importActual('../../utils/provenance')),
  resolveVersionWithProvenance: (...args: unknown[]) =>
    mockResolveVersionWithProvenance(...args),
}));

const mockInstallPackageToTmp = vi.fn();
vi.mock('../../utils/package-json', async () => ({
  ...(await vi.importActual('../../utils/package-json')),
  installPackageToTmp: (...args: unknown[]) => mockInstallPackageToTmp(...args),
}));

vi.mock('fs', async () => ({
  ...require('fs'),
  existsSync: vi.fn(() => false),
}));

vi.mock('./implementation/utils', async () => ({
  ...(await vi.importActual('./implementation/utils')),
  createNxJsonFile: vi.fn(),
  updateGitIgnore: vi.fn(),
  printFinalMessage: vi.fn(),
}));

vi.mock('./implementation/format', () => ({
  formatInitWrites: vi.fn(),
  recordInitWrite: vi.fn(),
}));

vi.mock('../../config/nx-json', async () => ({
  ...(await vi.importActual('../../config/nx-json')),
  readNxJson: vi.fn(() => ({})),
}));

vi.mock('../../utils/workspace-context', () => ({
  globWithWorkspaceContextSync: vi.fn(() => []),
}));

vi.mock('../../utils/child-process', async () => ({
  ...(await vi.importActual('../../utils/child-process')),
  runNxSync: vi.fn(),
}));

vi.mock('../../utils/ab-testing', async () => ({
  ...(await vi.importActual('../../utils/ab-testing')),
  recordStat: vi.fn(),
}));

vi.mock('../../utils/analytics-prompt', () => ({
  ensureAnalyticsPreferenceSet: vi.fn(),
}));

vi.mock('../../utils/output', () => ({ output: { log: vi.fn() } }));

vi.mock('../../native', async () => ({
  ...(await vi.importActual('../../native')),
  isAiAgent: () => false,
}));

import { ProvenanceError } from '../../utils/provenance';
import { nxVersion } from '../../utils/versions';
import { initHandler as initHandlerV1 } from './init-v1';
import { initHandler } from './init-v2';

describe('nx version of the .nx installation', () => {
  const originalEnv = process.env;
  const options = { interactive: false, nxCloud: false, aiAgents: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv };
    delete process.env.NX_VERSION;
    delete process.env.NX_USE_LOCAL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should be the running version when the provenance check refuses latest', async () => {
    mockResolveVersionWithProvenance.mockRejectedValue(
      new ProvenanceError('nx', 'latest', 'No attestation URL found')
    );

    await initHandler(options);

    expect(mockResolveVersionWithProvenance).toHaveBeenCalledWith(
      'nx',
      'latest',
      process.cwd()
    );
    expect(mockInstallPackageToTmp).not.toHaveBeenCalled();
    expect(mockGenerateDotNxSetup).toHaveBeenCalledTimes(1);
    expect(mockGenerateDotNxSetup).toHaveBeenCalledWith(nxVersion);
  });

  it('should be the running version when NX_USE_LOCAL skips the check', async () => {
    process.env.NX_USE_LOCAL = 'true';

    await initHandler(options);

    expect(mockResolveVersionWithProvenance).not.toHaveBeenCalled();
    expect(mockGenerateDotNxSetup).toHaveBeenCalledWith(nxVersion);
  });

  it('should be the running version for the v1 handler, which has no check', async () => {
    await initHandlerV1({
      interactive: false,
      integrated: false,
      useDotNxInstallation: true,
    });

    expect(mockGenerateDotNxSetup).toHaveBeenCalledWith(nxVersion);
  });

  it('should still honor NX_VERSION', async () => {
    process.env.NX_USE_LOCAL = 'true';
    process.env.NX_VERSION = '1.2.3';

    await initHandler(options);

    expect(mockGenerateDotNxSetup).toHaveBeenCalledWith('1.2.3');
  });
});
