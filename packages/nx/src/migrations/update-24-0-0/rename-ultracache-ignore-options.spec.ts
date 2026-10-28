import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import migration from './rename-ultracache-ignore-options';

describe('rename-ultracache-ignore-options migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('ultracache target options', () => {
    it('should rename the keys in project.json targets, keeping key order', async () => {
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: {
            command: 'echo build',
            ultracache: {
              mode: 'warn',
              ignoredReads: ['tmp/**'],
              ignoredWrites: ['out/**'],
              collectStats: true,
            } as any,
          },
        },
      });

      const result = await migration(tree);

      const ultracache = readProjectConfiguration(tree, 'app').targets.build
        .ultracache;
      expect(ultracache).toEqual({
        mode: 'warn',
        ignoreReads: ['tmp/**'],
        ignoreWrites: ['out/**'],
        collectStats: true,
      });
      expect(Object.keys(ultracache)).toEqual([
        'mode',
        'ignoreReads',
        'ignoreWrites',
        'collectStats',
      ]);
      expect(result).toEqual({ skipAgentic: true });
    });

    it('should rename the keys in package.json nx targets', async () => {
      writeJson(tree, 'libs/lib/package.json', {
        name: '@acme/lib',
        nx: {
          targets: {
            build: { ultracache: { ignoredReads: ['tmp/**'] } },
          },
        },
      });

      await migration(tree);

      expect(
        readJson(tree, 'libs/lib/package.json').nx.targets.build.ultracache
      ).toEqual({ ignoreReads: ['tmp/**'] });
    });

    it('should rename the keys in record and array targetDefaults', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { ultracache: { ignoredReads: ['...', 'tmp/**'] } as any },
        test: [
          { ultracache: { ignoredWrites: ['coverage/**'] } as any },
          {
            filter: { projects: 'tag:e2e' },
            ultracache: { mode: 'off' },
          } as any,
        ],
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toEqual({
        build: { ultracache: { ignoreReads: ['...', 'tmp/**'] } },
        test: [
          { ultracache: { ignoreWrites: ['coverage/**'] } },
          { filter: { projects: 'tag:e2e' }, ultracache: { mode: 'off' } },
        ],
      });
    });

    it('should merge patterns when a target declares both the old and new key', async () => {
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: {
            ultracache: {
              ignoreReads: ['a/**', 'b/**'],
              ignoredReads: ['b/**', 'c/**'],
            } as any,
          },
        },
      });

      await migration(tree);

      expect(
        readProjectConfiguration(tree, 'app').targets.build.ultracache
      ).toEqual({ ignoreReads: ['a/**', 'b/**', 'c/**'] });
    });

    it('should not change a workspace that does not use the old keys', async () => {
      // Pre-formatted, so the migration's format pass has nothing to change.
      tree.write(
        'apps/app/project.json',
        `{
  "name": "app",
  "targets": {
    "build": {
      "ultracache": {
        "mode": "off",
        "ignoreReads": ["tmp/**"]
      }
    }
  }
}
`
      );
      const projectJson = tree.read('apps/app/project.json', 'utf-8');
      const nxJson = readJson(tree, 'nx.json');

      const result = await migration(tree);

      expect(tree.read('apps/app/project.json', 'utf-8')).toBe(projectJson);
      expect(readJson(tree, 'nx.json')).toEqual(nxJson);
      expect(result).toEqual({ skipAgentic: true });
    });

    it('should be idempotent', async () => {
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: { ultracache: { ignoredReads: ['tmp/**'] } as any },
        },
      });

      await migration(tree);
      const once = tree.read('apps/app/project.json', 'utf-8');
      await migration(tree);

      expect(tree.read('apps/app/project.json', 'utf-8')).toBe(once);
    });
  });

  describe('workspace config file', () => {
    it('should rename the file and its keys', async () => {
      tree.write(
        '.nx/workflows/sandboxing-config.yaml',
        `# exclude-reads: stays a comment
exclude-reads:
  - 'dist/**'
'exclude-writes':
  - '**/.swc/**'

task-exclusions:
  - target: lint
    exclude-reads:
      - '**/*.json'
  - exclude-writes:
      - logs/**
    project: app
`
      );

      const result = await migration(tree);

      expect(tree.exists('.nx/workflows/sandboxing-config.yaml')).toBe(false);
      expect(tree.read('.nx/workflows/ultracache-config.yaml', 'utf-8'))
        .toEqual(`# exclude-reads: stays a comment
ignore-reads:
  - 'dist/**'
'ignore-writes':
  - '**/.swc/**'

task-exclusions:
  - target: lint
    ignore-reads:
      - '**/*.json'
  - ignore-writes:
      - logs/**
    project: app
`);
      expect(result).toEqual({ skipAgentic: true });
    });

    it('should keep the .yml extension', async () => {
      tree.write('.nx/workflows/sandboxing-config.yml', 'exclude-reads: []\n');

      await migration(tree);

      expect(tree.read('.nx/workflows/ultracache-config.yml', 'utf-8')).toBe(
        'ignore-reads: []\n'
      );
    });

    it('should report a conflict when both files exist', async () => {
      tree.write('.nx/workflows/sandboxing-config.yaml', 'exclude-reads: []\n');
      tree.write(
        '.nx/workflows/ultracache-config.yaml',
        'ignore-reads:\n  - tmp/**\n'
      );

      const result = await migration(tree);

      expect(tree.read('.nx/workflows/sandboxing-config.yaml', 'utf-8')).toBe(
        'exclude-reads: []\n'
      );
      expect(tree.read('.nx/workflows/ultracache-config.yaml', 'utf-8')).toBe(
        'ignore-reads:\n  - tmp/**\n'
      );
      expect(result).toEqual({
        nextSteps: [expect.stringContaining('merge the patterns from')],
        agentContext: [expect.stringContaining('merge the patterns from')],
      });
    });

    it('should report keys it cannot rewrite', async () => {
      tree.write(
        '.nx/workflows/sandboxing-config.yaml',
        '{ exclude-reads: [dist/**] }\n'
      );

      const result = await migration(tree);

      expect(result).toEqual({
        nextSteps: [
          expect.stringContaining('.nx/workflows/ultracache-config.yaml'),
        ],
        agentContext: [
          expect.stringContaining('.nx/workflows/ultracache-config.yaml'),
        ],
      });
    });

    it('should rewrite references to the file in inputs', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.namedInputs = {
          sharedGlobals: [
            '{workspaceRoot}/.nx/workflows/sandboxing-config.yaml',
            '{workspaceRoot}/.nx/workflows/agents.yaml',
          ],
        };
        return json;
      });
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: {
            inputs: [
              { input: '{workspaceRoot}/.nx/workflows/sandboxing-config.yml' },
            ] as any,
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).namedInputs.sharedGlobals).toEqual([
        '{workspaceRoot}/.nx/workflows/ultracache-config.yaml',
        '{workspaceRoot}/.nx/workflows/agents.yaml',
      ]);
      expect(
        readProjectConfiguration(tree, 'app').targets.build.inputs
      ).toEqual([
        { input: '{workspaceRoot}/.nx/workflows/ultracache-config.yml' },
      ]);
    });

    it('should not change a workspace without the file', async () => {
      const result = await migration(tree);

      expect(tree.exists('.nx/workflows/ultracache-config.yaml')).toBe(false);
      expect(result).toEqual({ skipAgentic: true });
    });
  });
});
