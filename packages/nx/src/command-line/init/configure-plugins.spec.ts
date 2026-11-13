vi.mock('../../utils/child-process', () => ({ runNxSync: vi.fn() }));
vi.mock('../generate/generator-utils', () => ({
  getGeneratorInformation: vi.fn(),
}));

import { runNxSync } from '../../utils/child-process';
import { getGeneratorInformation } from '../generate/generator-utils';
import { runPluginInitGenerator } from './configure-plugins';

describe('runPluginInitGenerator', () => {
  const pmc = { exec: 'npx' } as any;

  beforeEach(() => {
    vi.mocked(getGeneratorInformation).mockReturnValue({
      schema: { properties: { keepExistingVersions: {} } },
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('appends extra arguments to the init generator command', async () => {
    await runPluginInitGenerator('@org/plugin', '/root', false, false, pmc, [
      '--programName=foo',
      '--skipFormat',
    ]);

    expect(vi.mocked(runNxSync).mock.calls[0][0]).toBe(
      'g @org/plugin:init  --keepExistingVersions --programName=foo --skipFormat'
    );
  });

  it('runs the init generator without extra arguments by default', async () => {
    await runPluginInitGenerator('@org/plugin', '/root', false, false, pmc);

    expect(vi.mocked(runNxSync).mock.calls[0][0]).toBe(
      'g @org/plugin:init  --keepExistingVersions'
    );
  });

  it('does not run anything when the plugin has no init generator', async () => {
    vi.mocked(getGeneratorInformation).mockImplementation(() => {
      throw new Error('not found');
    });

    await runPluginInitGenerator('@org/plugin', '/root', false, false, pmc, [
      '--programName=foo',
    ]);

    expect(runNxSync).not.toHaveBeenCalled();
  });
});
