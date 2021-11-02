import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { join } from 'path';
import {
  convertToESLintConfig,
  convertTSLintDisableCommentsForProject,
} from './convert-to-eslint-config';
import {
  exampleAngularProjectTslintJson,
  exampleE2eProjectTslintJson,
  exampleNonAngularProjectTslintJson,
  exampleRootTslintJson,
} from './example-tslint-configs';

/**
 * The actual `findReportedConfiguration()` function is used to execute
 * `tslint --print-config` in a child process and read from the real
 * file system. This won't work for us in tests where we are dealing
 * with a Tree, so we mock out the responses from `findReportedConfiguration()`
 * with previously captured result data from that same command.
 */

export function mockFindReportedConfiguration(_, pathToTSLintJson) {
  if (
    pathToTSLintJson === 'tslint.json' ||
    pathToTSLintJson === '/tslint.json'
  ) {
    return exampleRootTslintJson.tslintPrintConfigResult;
  }

  if (
    pathToTSLintJson === 'apps/app1/tslint.json' ||
    pathToTSLintJson === 'libs/lib1/tslint.json'
  ) {
    return exampleAngularProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app1-e2e/tslint.json') {
    return exampleE2eProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app2/tslint.json') {
    return exampleNonAngularProjectTslintJson.tslintPrintConfigResult;
  }

  throw new Error(
    `${pathToTSLintJson} is not a part of the supported mock data for these tests`
  );
}

/**
 * See ./mock-tslint-to-eslint-config.ts for why this is needed
 */
jest.mock('tslint-to-eslint-config', () => {
  return {
    // Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
    // @ts-ignore
    ...jest.requireActual<any>('tslint-to-eslint-config'),
    findReportedConfiguration: jest.fn(mockFindReportedConfiguration),
  };
});

describe('convertToESLintConfig()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should work for a root tslint.json file', async () => {
    const converted = await convertToESLintConfig(
      'tslint.json',
      exampleRootTslintJson.raw,
      []
    );
    // Ensure no-console snapshot is deterministic
    converted.convertedESLintConfig.rules['no-console'][1].allow.sort();
    expect(converted).toMatchSnapshot();
  });

  it('should work for a project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1/tslint.json',
        exampleAngularProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for an e2e project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1-e2e/tslint.json',
        exampleE2eProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for a non-Angular project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app2/tslint.json',
        exampleNonAngularProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });
});

describe('convertTSLintDisableCommentsForProject', () => {
  let tree: Tree;
  const projectName = 'foo';
  const projectRoot = `apps/${projectName}`;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, projectName, {
      root: projectRoot,
      projectType: 'application',
      targets: {
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**', `!${projectRoot}/**/*`],
            tsConfig: [`${projectRoot}/tsconfig.app.json`],
          },
        },
      },
    });
    tree.write(
      join(projectRoot, 'top-level-file.ts'),
      `
      // tslint:disable
      eval('');
    `
    );
    tree.write(
      join(projectRoot, 'single-level-nested/file.ts'),
      `
      // tslint:disable-next-line
      eval('');
    `
    );
    // specific rule, and multi-line-comment style
    tree.write(
      join(projectRoot, 'multi-level/nested/file.ts'),
      `
      /* tslint:disable:quotemark */
      eval('');
    `
    );
  });
  it('should replace tslint:disable comments with their ESLint equivalents in .ts files for the given project', () => {
    convertTSLintDisableCommentsForProject(tree, projectName);

    expect(
      tree.read(join(projectRoot, 'top-level-file.ts'), 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(join(projectRoot, 'single-level-nested/file.ts'), 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(join(projectRoot, 'multi-level/nested/file.ts'), 'utf-8')
    ).toMatchSnapshot();
  });
});
