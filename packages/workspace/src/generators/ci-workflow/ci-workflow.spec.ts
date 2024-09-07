import {
  PackageManager,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ciWorkflowGenerator } from './ci-workflow';
import { vol } from 'memfs';

jest.mock('child_process', () => {
  const cp = jest.requireActual('child_process');
  return {
    ...cp,
    execSync: (...args) => {
      if (args[0] === 'yarn --version') {
        return '1.22.10';
      } else {
        return cp.execSync(...args);
      }
    },
  };
});

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('fs', () => {
  const memFs = require('memfs').fs;
  const actualFs = jest.requireActual<any>('fs');
  return {
    ...jest.requireActual<any>('fs'),
    existsSync: (p) =>
      p.endsWith('yarn.lock') ||
      p.endsWith('pnpm-lock.yaml') ||
      p.endsWith('bun.lockb')
        ? memFs.existsSync(p)
        : actualFs.existsSync(p),
  };
});

describe('CI Workflow generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    vol.reset();
  });

  describe.each([
    ['connected to nxCloud', true],
    ['not connected to nxCloud', false],
  ] as const)(`%s`, (_, connectedToCloud) => {
    let nxCloudAccessToken: string;

    beforeEach(() => {
      if (connectedToCloud) {
        const nxJson = readNxJson(tree);
        nxJson.nxCloudAccessToken = 'test';
        updateNxJson(tree, nxJson);
      } else {
        nxCloudAccessToken = process.env.NX_CLOUD_ACCESS_TOKEN;
        delete process.env.NX_CLOUD_ACCESS_TOKEN;
      }
    });

    afterEach(() => {
      if (connectedToCloud) {
        const nxJson = readNxJson(tree);
        delete nxJson.nxCloudAccessToken;
        updateNxJson(tree, nxJson);
      } else {
        process.env.NX_CLOUD_ACCESS_TOKEN = nxCloudAccessToken;
      }
    });

    ['npm', 'yarn', 'pnpm', 'bun'].forEach((packageManager: PackageManager) => {
      describe(`with ${packageManager}`, () => {
        beforeEach(() => {
          let fileSys;
          if (packageManager === 'bun') {
            fileSys = { 'bun.lockb': '' };
          } else if (packageManager === 'yarn') {
            fileSys = { 'yarn.lock': '' };
          } else if (packageManager === 'pnpm') {
            fileSys = { 'pnpm-lock.yaml': '' };
          } else {
            fileSys = { 'package-lock.json': '' };
          }
          vol.fromJSON(fileSys, '');
        });

        it('should generate github CI config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

          expect(
            tree.read('.github/workflows/ci.yml', 'utf-8')
          ).toMatchSnapshot();
        });

        it('should generate circleci CI config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });

          expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
        });

        it('should generate azure CI config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'azure', name: 'CI' });

          expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchSnapshot();
        });

        it('should generate github CI config with custom name', async () => {
          await ciWorkflowGenerator(tree, {
            ci: 'github',
            name: 'My custom-workflow',
          });

          expect(
            tree.read('.github/workflows/my-custom-workflow.yml', 'utf-8')
          ).toMatchSnapshot();
        });

        it('should generate bitbucket pipelines config', async () => {
          await ciWorkflowGenerator(tree, {
            ci: 'bitbucket-pipelines',
            name: 'CI',
          });

          expect(
            tree.read('bitbucket-pipelines.yml', 'utf-8')
          ).toMatchSnapshot();
        });

        it('should prefix nx.json affected defaultBase with origin/ if ci is bitbucket-pipelines', async () => {
          const nxJson = readJson(tree, 'nx.json');
          nxJson.affected.defaultBase = 'my-branch';
          writeJson(tree, 'nx.json', nxJson);

          await ciWorkflowGenerator(tree, {
            ci: 'bitbucket-pipelines',
            name: 'CI',
          });

          expect(readJson(tree, 'nx.json').affected.defaultBase).toEqual(
            'origin/my-branch'
          );
        });

        it('should prefix nx.json base with origin/ if ci is bitbucket-pipelines', async () => {
          const nxJson = readNxJson(tree);
          nxJson.defaultBase = 'my-branch';
          writeJson(tree, 'nx.json', nxJson);

          await ciWorkflowGenerator(tree, {
            ci: 'bitbucket-pipelines',
            name: 'CI',
          });

          expect(readNxJson(tree).defaultBase).toEqual('origin/my-branch');
        });

        it('should generate gitlab config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'gitlab', name: 'CI' });

          expect(tree.read('.gitlab-ci.yml', 'utf-8')).toMatchSnapshot();
        });
      });
    });

    describe('optional e2e', () => {
      beforeEach(() => {
        updateJson(tree, 'package.json', (json) => {
          json.devDependencies = {
            ...json.devDependencies,
            '@nx/cypress': 'latest',
          };
          return json;
        });
      });

      it('should add e2e to github CI config', async () => {
        await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

        expect(
          tree.read('.github/workflows/ci.yml', 'utf-8')
        ).toMatchSnapshot();
      });

      it('should add e2e to circleci CI config', async () => {
        await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });

        expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
      });

      it('should add e2e to azure CI config', async () => {
        await ciWorkflowGenerator(tree, { ci: 'azure', name: 'CI' });

        expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchSnapshot();
      });

      it('should add e2e to github CI config with custom name', async () => {
        await ciWorkflowGenerator(tree, {
          ci: 'github',
          name: 'My custom-workflow',
        });

        expect(
          tree.read('.github/workflows/my-custom-workflow.yml', 'utf-8')
        ).toMatchSnapshot();
      });

      it('should add e2e to bitbucket pipelines config', async () => {
        await ciWorkflowGenerator(tree, {
          ci: 'bitbucket-pipelines',
          name: 'CI',
        });

        expect(tree.read('bitbucket-pipelines.yml', 'utf-8')).toMatchSnapshot();
      });
    });
  });

  it('should add workflow files to namedInputs.sharedGlobals', async () => {
    await ciWorkflowGenerator(tree, { ci: 'azure', name: 'CI' });
    await ciWorkflowGenerator(tree, { ci: 'bitbucket-pipelines', name: 'CI' });
    await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });
    await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });
    await ciWorkflowGenerator(tree, { ci: 'gitlab', name: 'CI' });

    expect(readJson(tree, 'nx.json').namedInputs.sharedGlobals).toEqual([
      '{workspaceRoot}/azure-pipelines.yml',
      '{workspaceRoot}/bitbucket-pipelines.yml',
      '{workspaceRoot}/.circleci/config.yml',
      '{workspaceRoot}/.github/workflows/ci.yml',
      '{workspaceRoot}/.gitlab-ci.yml',
    ]);
  });

  it('should add workflow files to namedInputs.sharedGlobals and update default', async () => {
    await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.namedInputs.sharedGlobals).toEqual([
      '{workspaceRoot}/.github/workflows/ci.yml',
    ]);
    expect(nxJson.namedInputs.default).toEqual(['sharedGlobals']);
  });

  it('should append sharedGlobals to existing default namedInput', async () => {
    // Set up initial nx.json with existing default namedInput
    const initialNxJson = readJson(tree, 'nx.json');
    initialNxJson.namedInputs = {
      default: ['existing'],
    };
    writeJson(tree, 'nx.json', initialNxJson);

    await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

    const updatedNxJson = readJson(tree, 'nx.json');
    expect(updatedNxJson.namedInputs.sharedGlobals).toEqual([
      '{workspaceRoot}/.github/workflows/ci.yml',
    ]);
    expect(updatedNxJson.namedInputs.default).toEqual([
      'existing',
      'sharedGlobals',
    ]);
  });
});
