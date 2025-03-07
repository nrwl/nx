import { type CreateNodesContext } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/rspack', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
    tempFs = new TempFs('rspack-test');
    context = {
      configFiles: [],
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };

    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync('my-app/rspack.config.ts', `export default {};`);
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  it('should handle missing lock file', async () => {
    await expect(
      createNodesFunction(['my-app/rspack.config.ts'], {}, context)
    ).resolves.not.toThrow();
  });
});
