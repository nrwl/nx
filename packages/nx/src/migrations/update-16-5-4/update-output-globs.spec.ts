import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { TargetConfiguration } from '../../config/workspace-json-project-json';
import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '../../generators/utils/project-configuration';
import updateOutputsGlobs from './update-output-globs';
import { readJson, updateJson } from '../../generators/utils/json';
import { NxJsonConfiguration } from '../../config/nx-json';

describe('update output globs', () => {
  it('should update output globs', () => {
    const tree = createTreeWithEmptyWorkspace();
    const targets: Record<string, TargetConfiguration> = {
      build: {
        outputs: ['{options.outputPath}', 'dist/apps/my-app/*.(js|map|ts)'],
      },
      lint: {},
      test: {
        outputs: ['dist/apps/my-app/main.(js|map|ts)'],
      },
      run: {
        outputs: ['dist/apps/my-app'],
      },
    };
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets,
    });

    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {
        lint: {
          outputs: ['dist/apps/my-app', '*.(js|map|ts)'],
        },
      };
      return json;
    });

    updateOutputsGlobs(tree);

    const migratedTargets = readProjectConfiguration(tree, 'my-app').targets;
    expect(migratedTargets).toMatchInlineSnapshot(`
      {
        "build": {
          "outputs": [
            "{options.outputPath}",
            "dist/apps/my-app/*.{js,map,ts}",
          ],
        },
        "lint": {},
        "run": {
          "outputs": [
            "dist/apps/my-app",
          ],
        },
        "test": {
          "outputs": [
            "dist/apps/my-app/main.{js,map,ts}",
          ],
        },
      }
    `);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "lint": {
          "outputs": [
            "dist/apps/my-app",
            "*.{js,map,ts}",
          ],
        },
      }
    `);
  });
});
