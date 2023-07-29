import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '../../../utils/lint';
import { NormalizedSchema } from '../schema';
import { updateEslintrcJson } from './update-eslintrc-json';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateEslint', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: '@proj/shared-my-destination',
      updateImportPath: true,
      newProjectName: 'shared-my-destination',
      relativeToRootDestination: 'libs/shared/my-destination',
    };

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should handle .eslintrc.json not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
    });

    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    expect(() => {
      updateEslintrcJson(tree, schema, projectConfig);
    }).not.toThrow();
  });

  it('should update .eslintrc.json extends path when project is moved to subdirectory', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
    });
    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json')
    ).toEqual(
      expect.objectContaining({
        extends: ['../../../.eslintrc.json'],
      })
    );
  });

  it('should update .eslintrc.json extends path when project is moved from subdirectory', async () => {
    await libraryGenerator(tree, {
      name: 'test',
      directory: 'api',
      linter: Linter.EsLint,
    });
    // This step is usually handled elsewhere
    tree.rename('libs/api/test/.eslintrc.json', 'libs/test/.eslintrc.json');
    const projectConfig = readProjectConfiguration(tree, 'api-test');

    const newSchema = {
      projectName: 'api-test',
      destination: 'test',
      importPath: '@proj/test',
      updateImportPath: true,
      newProjectName: 'test',
      relativeToRootDestination: 'libs/test',
    };

    updateEslintrcJson(tree, newSchema, projectConfig);

    expect(readJson(tree, '/libs/test/.eslintrc.json')).toEqual(
      expect.objectContaining({
        extends: ['../../.eslintrc.json'],
      })
    );
  });

  it('should preserve .eslintrc.json non-relative extends when project is moved to subdirectory', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
    });
    updateJson(tree, 'libs/my-lib/.eslintrc.json', (eslintRcJson) => {
      eslintRcJson.extends = [
        'plugin:@nx/react',
        '../../.eslintrc.json',
        './customrc.json',
      ];
      return eslintRcJson;
    });
    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json')
    ).toEqual(
      expect.objectContaining({
        extends: [
          'plugin:@nx/react',
          '../../../.eslintrc.json',
          './customrc.json',
        ],
      })
    );
  });

  it('should update .eslintrc.json overrides parser project when project is moved', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
      setParserOptionsProject: true,
    });
    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json')
    ).toEqual(
      expect.objectContaining({
        overrides: expect.arrayContaining([
          expect.objectContaining({
            parserOptions: expect.objectContaining({
              project: ['libs/shared/my-destination/tsconfig.*?.json'],
            }),
          }),
        ]),
      })
    );
  });

  it('should update multiple .eslintrc.json overrides parser project when project is moved', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
      setParserOptionsProject: true,
    });

    // Add another parser project to eslint.json
    const storybookProject = '.storybook/tsconfig.json';
    updateJson(tree, '/libs/my-lib/.eslintrc.json', (eslintRcJson) => {
      eslintRcJson.overrides[0].parserOptions.project.push(
        `libs/my-lib/${storybookProject}`
      );
      return eslintRcJson;
    });

    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json')
    ).toEqual(
      expect.objectContaining({
        overrides: expect.arrayContaining([
          expect.objectContaining({
            parserOptions: expect.objectContaining({
              project: [
                'libs/shared/my-destination/tsconfig.*?.json',
                `libs/shared/my-destination/${storybookProject}`,
              ],
            }),
          }),
        ]),
      })
    );
  });

  it('should update .eslintrc.json parserOptions.project as a string', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
      setParserOptionsProject: true,
    });

    // Add another parser project to eslint.json
    const storybookProject = '.storybook/tsconfig.json';
    updateJson(tree, '/libs/my-lib/.eslintrc.json', (eslintRcJson) => {
      eslintRcJson.overrides[0].parserOptions.project = `libs/my-lib/${storybookProject}`;
      return eslintRcJson;
    });

    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json').overrides[0]
        .parserOptions
    ).toEqual({ project: `libs/shared/my-destination/${storybookProject}` });
  });
});
