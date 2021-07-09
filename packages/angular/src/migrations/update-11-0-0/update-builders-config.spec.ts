import { Tree } from '@angular-devkit/schematics';
import {
  getWorkspace,
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('11.0.0 Migration: Update Builders Config', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'app1',
          root: 'apps/app1',
          sourceRoot: 'apps/app1/src',
          projectType: 'application',
          targets: {
            build: {
              builder: '@angular-devkit/build-angular:browser',
              options: {
                main: 'main.ts',
                styles: [
                  'styles.scss',
                  {
                    input: 'more-styles.scss',
                    lazy: true,
                  },
                ],
                scripts: [
                  'scripts.ts',
                  {
                    input: 'more-scripts.ts',
                    lazy: true,
                  },
                ],
                environment: 'production',
                extractCss: true,
                tsconfigFileName: 'tsconfig.json',
                rebaseRootRelativeCssUrls: true,
              },
            },
          },
        });
        workspace.projects.add({
          name: 'lib1',
          root: 'libs/lib1',
          sourceRoot: 'libs/lib1/src',
          projectType: 'library',
          targets: {
            build: {
              builder: '@angular-devkit/build-ng-packagr:build',
              options: {
                project: 'ng-package.json',
                tsConfig: 'tsconfig.json',
              },
            },
          },
        });
      }),
      tree
    );
  });

  it('should update the build configuration', async () => {
    const result = await runMigration('update-11-0-0', {}, tree);

    const workspace = await getWorkspace(result);

    const proxyOptions = workspace.projects
      .get('app1')
      .targets.get('build').options;
    const options = {
      ...proxyOptions,
      styles: [...(proxyOptions.styles as any[])],
      scripts: [...(proxyOptions.scripts as any[])],
    };
    const expected = {
      main: 'main.ts',
      styles: [
        'styles.scss',
        {
          input: 'more-styles.scss',
          inject: false,
        },
      ],
      scripts: [
        'scripts.ts',
        {
          input: 'more-scripts.ts',
          inject: false,
        },
      ],
    };
    expect(options).toEqual(expected);
  });

  it('should update the library build configuration', async () => {
    tree = await callRule(
      updateJsonInTree('package.json', (json) => {
        json.devDependencies['@angular-devkit/build-ng-packagr'] = '10.0.0';
        return json;
      }),
      tree
    );
    const result = await runMigration('update-11-0-0', {}, tree);

    const workspace = await getWorkspace(result);

    expect(workspace.projects.get('lib1').targets.get('build').builder).toEqual(
      '@angular-devkit/build-angular:ng-packagr'
    );

    const packageJson = readJsonInTree(result, 'package.json');
    expect(
      packageJson.devDependencies['@angular-devkit/build-ng-packagr']
    ).not.toBeDefined();
  });
});
