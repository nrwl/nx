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
      p.endsWith('bun.lockb') ||
      p.endsWith('bun.lock')
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
      } else if (nxCloudAccessToken) {
        process.env.NX_CLOUD_ACCESS_TOKEN = nxCloudAccessToken;
      } else {
        delete process.env.NX_CLOUD_ACCESS_TOKEN;
      }
    });

    ['npm', 'yarn', 'pnpm', 'bun'].forEach((packageManager: PackageManager) => {
      describe(`with ${packageManager}`, () => {
        beforeEach(() => {
          let fileSys;
          if (packageManager === 'bun') {
            fileSys = { 'bun.lock': '' };
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

        it('should generate github CI config when packageManager is defined in package.json', async () => {
          updateJson(tree, 'package.json', (json) => ({
            ...json,
            packageManager: `${packageManager}@latest`,
          }));

          await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

          expect(
            tree.read('.github/workflows/ci.yml', 'utf-8')
          ).toMatchSnapshot();
        });

        it('should generate circleci CI config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });

          expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
        });

        it(`should generate circleci CI config when packageManager is set to ${packageManager} in package.json`, async () => {
          updateJson(tree, 'package.json', (json) => ({
            ...json,
            packageManager: `${packageManager}@latest`,
          }));

          await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });

          expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
        });

        it('should generate azure CI config', async () => {
          await ciWorkflowGenerator(tree, { ci: 'azure', name: 'CI' });

          expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchSnapshot();
        });

        it('should generate azure CI config when packageManager is set to ${packageManager} in package.json', async () => {
          updateJson(tree, 'package.json', (json) => ({
            ...json,
            packageManager: `${packageManager}@latest`,
          }));

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

        it('should generate bitbucket pipelines config when packageManager is set to ${packageManager} in package.json', async () => {
          updateJson(tree, 'package.json', (json) => ({
            ...json,
            packageManager: `${packageManager}@latest`,
          }));

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

  describe('TS solution setup', () => {
    let nxCloudAccessToken: string;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      nxCloudAccessToken = process.env.NX_CLOUD_ACCESS_TOKEN;
      delete process.env.NX_CLOUD_ACCESS_TOKEN;
    });

    afterEach(() => {
      if (nxCloudAccessToken) {
        process.env.NX_CLOUD_ACCESS_TOKEN = nxCloudAccessToken;
      } else {
        delete process.env.NX_CLOUD_ACCESS_TOKEN;
      }
    });

    it('should generate github config with typecheck task', async () => {
      await ciWorkflowGenerator(tree, { ci: 'github', name: 'CI' });

      expect(tree.read('.github/workflows/ci.yml', 'utf-8'))
        .toMatchInlineSnapshot(`
        "name: CI

        on:
          push:
            branches:
              - main
          pull_request:

        permissions:
          actions: read
          contents: read

        jobs:
          main:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v4
                with:
                  filter: tree:0
                  fetch-depth: 0

              # This enables task distribution via Nx Cloud
              # Run this command as early as possible, before dependencies are installed
              # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
              # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
              # - run: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

              # Cache node_modules
              - uses: actions/setup-node@v4
                with:
                  node-version: 20
                  cache: 'npm'

              - run: npm ci --legacy-peer-deps
              - uses: nrwl/nx-set-shas@v4

              # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
              # - run: npx nx-cloud record -- echo Hello World
              # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
              - run: npx nx affected -t lint test build typecheck
              # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
              - run: npx nx fix-ci
                if: always()
        "
      `);
    });

    it('should generate circleci config with typecheck task', async () => {
      await ciWorkflowGenerator(tree, { ci: 'circleci', name: 'CI' });

      expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchInlineSnapshot(`
        "version: 2.1

        orbs:
          nx: nrwl/nx@1.6.2

        jobs:
          main:
            docker:
              - image: cimg/node:lts-browsers
            steps:
              - checkout

              # This enables task distribution via Nx Cloud
              # Run this command as early as possible, before dependencies are installed
              # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
              # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
              # - run: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

              - run: npm ci --legacy-peer-deps
              - nx/set-shas:
                  main-branch-name: 'main'

              # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
              # - run: npx nx-cloud record -- echo Hello World
              # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
              - run:
                  command: npx nx affected -t lint test build typecheck
              # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
              - run:
                  command: npx nx fix-ci
                  when: always

        workflows:
          version: 2

          ci:
            jobs:
              - main
        "
      `);
    });

    it('should generate azure config with typecheck task', async () => {
      await ciWorkflowGenerator(tree, { ci: 'azure', name: 'CI' });

      expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchInlineSnapshot(`
        "name: CI

        trigger:
          - main
        pr:
          - main

        variables:
          CI: 'true'
          \${{ if eq(variables['Build.Reason'], 'PullRequest') }}:
            NX_BRANCH: $(System.PullRequest.PullRequestNumber)
            TARGET_BRANCH: $[replace(variables['System.PullRequest.TargetBranch'],'refs/heads/','origin/')]
            BASE_SHA: $(git merge-base $(TARGET_BRANCH) HEAD)
          \${{ if ne(variables['Build.Reason'], 'PullRequest') }}:
            NX_BRANCH: $(Build.SourceBranchName)
            BASE_SHA: $(git rev-parse HEAD~1)
          HEAD_SHA: $(git rev-parse HEAD)

        jobs:
          - job: main
            pool:
              vmImage: 'ubuntu-latest'
            steps:
              - checkout: self
                fetchDepth: 0
                fetchFilter: tree:0
              # Set Azure Devops CLI default settings
              - bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
                displayName: 'Set default Azure DevOps organization and project'
              # Get last successfull commit from Azure Devops CLI
              - bash: |
                  LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\\"ci.sourceSha\\"")
                  if [ -z "$LAST_SHA" ]
                  then
                    echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
                  else
                    echo "Last successful commit SHA: $LAST_SHA"
                    echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
                  fi
                displayName: 'Get last successful commit SHA'
                condition: ne(variables['Build.Reason'], 'PullRequest')
                env:
                  AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)

              # This enables task distribution via Nx Cloud
              # Run this command as early as possible, before dependencies are installed
              # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
              # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
              # - script: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

              - script: npm ci --legacy-peer-deps
              - script: git branch --track main origin/main
                condition: eq(variables['Build.Reason'], 'PullRequest')

              # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
              # - script: npx nx-cloud record -- echo Hello World
              # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
              - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint test build typecheck
              # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
              - script: npx nx fix-ci
                condition: always()
        "
      `);
    });

    it('should generate bitbucket config with typecheck task', async () => {
      await ciWorkflowGenerator(tree, {
        ci: 'bitbucket-pipelines',
        name: 'CI',
      });

      expect(tree.read('bitbucket-pipelines.yml', 'utf-8'))
        .toMatchInlineSnapshot(`
        "image: node:20

        clone:
          depth: full

        pipelines:
          pull-requests:
            '**':
              - step:
                  name: 'Build and test affected apps on Pull Requests'
                  script:
                    - export NX_BRANCH=$BITBUCKET_PR_ID

                    # This enables task distribution via Nx Cloud
                    # Run this command as early as possible, before dependencies are installed
                    # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
                    # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
                    # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

                    - npm ci --legacy-peer-deps

                    # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
                    # npx nx-cloud record -- echo Hello World
                    # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
                    - npx nx affected --base=origin/main -t lint test build typecheck
                    # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci

                  after-script:
                    - npx nx fix-ci

          branches:
            main:
              - step:
                  name: 'Build and test affected apps on "main" branch changes'
                  script:
                    - export NX_BRANCH=$BITBUCKET_BRANCH
                    # This enables task distribution via Nx Cloud
                    # Run this command as early as possible, before dependencies are installed
                    # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
                    # Connect your workspace by running "nx connect" and uncomment this
                    # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

                    - npm ci --legacy-peer-deps

                    # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
                    # - npx nx-cloud record -- echo Hello World
                    # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
                    - npx nx affected -t lint test build typecheck --base=HEAD~1
        "
      `);
    });

    it('should generate gitlab config with typecheck task', async () => {
      await ciWorkflowGenerator(tree, { ci: 'gitlab', name: 'CI' });

      expect(tree.read('.gitlab-ci.yml', 'utf-8')).toMatchInlineSnapshot(`
        "image: node:20
        variables:
          CI: 'true'

        # Main job
        CI:
          interruptible: true
          only:
            - main
            - merge_requests
          script:
            # This enables task distribution via Nx Cloud
            # Run this command as early as possible, before dependencies are installed
            # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
            # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
            # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

            - npm ci --legacy-peer-deps
            - NX_HEAD=$CI_COMMIT_SHA
            - NX_BASE=\${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

            # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
            # - npx nx-cloud record -- echo Hello World
            # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
            - npx nx affected -t lint test build typecheck
            # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci

          after_script:
            - npx nx fix-ci
        "
      `);
    });
  });

  describe('useRunMany flag', () => {
    it('should use nx affected when useRunMany is false', async () => {
      await ciWorkflowGenerator(tree, {
        ci: 'github',
        name: 'CI',
        useRunMany: false,
      });

      const content = tree.read('.github/workflows/ci.yml', 'utf-8');
      expect(content).toContain('nx affected -t lint test build');
      expect(content).toContain(
        'Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected'
      );
      expect(content).not.toContain('nx run-many');
    });

    it('should use nx run-many when useRunMany is true', async () => {
      await ciWorkflowGenerator(tree, {
        ci: 'github',
        name: 'CI',
        useRunMany: true,
      });

      const content = tree.read('.github/workflows/ci.yml', 'utf-8');
      expect(content).toContain('nx run-many -t lint test build');
      expect(content).toContain(
        'As your workspace grows, you can change this to use Nx Affected to run only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected'
      );
      expect(content).not.toContain('nx affected');
    });

    it('should default to nx affected when useRunMany is not specified', async () => {
      await ciWorkflowGenerator(tree, {
        ci: 'github',
        name: 'CI',
      });

      const content = tree.read('.github/workflows/ci.yml', 'utf-8');
      expect(content).toContain('nx affected -t lint test build');
      expect(content).not.toContain('nx run-many');
    });
  });
});
