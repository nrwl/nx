import { TargetConfiguration } from '../../config/workspace-json-project-json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson, writeJson } from '../../generators/utils/json';
import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { assertRunsAgainstNxRepo } from '../../../internal-testing-utils/run-migration-against-this-workspace';
import removeRunCommandsOutputPath from './remove-run-commands-output-path';

describe('removeRunCommandsOutputPath', () => {
  it('should migrate target options correctly', () => {
    const tree = createTreeWithEmptyWorkspace();
    const startingTargets: Record<string, TargetConfiguration> = {
      build: {
        executor: 'nx:run-commands',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: 'dist/apps/my-app',
          commands: [],
        },
      },
      other: {
        executor: 'nx:run-script',
        options: {
          script: 'start',
        },
      },
    };
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: startingTargets,
    });
    removeRunCommandsOutputPath(tree);
    const migratedTargets = readProjectConfiguration(tree, 'my-app').targets;
    expect(migratedTargets.build).not.toEqual(startingTargets.build);
    expect(migratedTargets.build).toEqual({
      executor: 'nx:run-commands',
      outputs: ['{workspaceRoot}/dist/apps/my-app'],
      options: {
        commands: [],
      },
    });
    expect(migratedTargets.other).toEqual(startingTargets.other);
  });

  it('should handle null options correctly', () => {
    const tree = createTreeWithEmptyWorkspace();
    const startingTargets: Record<string, TargetConfiguration> = {
      build: {
        executor: 'nx:run-commands',
        outputs: ['dist/some/path'],
      },
    };
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: startingTargets,
    });
    expect(() => removeRunCommandsOutputPath(tree)).not.toThrow();
    const migratedTargets = readProjectConfiguration(tree, 'my-app').targets;
    expect(migratedTargets.build).toEqual(startingTargets.build);
    expect(migratedTargets.other).toEqual(startingTargets.other);
  });

  it('should migrate target defaults correctly', () => {
    const tree = createTreeWithEmptyWorkspace();
    const startingTargetDefaults: Record<string, TargetConfiguration> = {
      build: {
        executor: 'nx:run-commands',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: 'dist/apps/my-app',
          commands: [],
        },
      },
      other: {
        executor: 'nx:run-script',
        options: {
          script: 'start',
        },
      },
    };
    writeJson(tree, 'nx.json', {
      targetDefaults: startingTargetDefaults,
    });
    removeRunCommandsOutputPath(tree);
    const migratedTargetDefaults = readJson(tree, 'nx.json').targetDefaults;
    expect(migratedTargetDefaults.build).not.toEqual(
      startingTargetDefaults.build
    );
    expect(migratedTargetDefaults.build).toEqual({
      executor: 'nx:run-commands',
      outputs: ['{workspaceRoot}/dist/apps/my-app'],
      options: {
        commands: [],
      },
    });
    expect(migratedTargetDefaults.other).toEqual(startingTargetDefaults.other);
  });

  assertRunsAgainstNxRepo(removeRunCommandsOutputPath);
});
