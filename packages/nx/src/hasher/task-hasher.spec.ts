// This must come before the Hasher import

import {
  expandNamedInput,
  expandSingleProjectInputs,
  filterUsingGlobPatterns,
  getDependenciesWithOutputsToHash,
  splitInputsIntoSelfAndDependencies,
} from './task-hasher';

describe('TaskHasher', () => {
  describe('splitInputsIntoSelfAndDependencies', () => {
    it('should identify ^{projectRoot}/**/*.ts as a dependency fileset', () => {
      const result = splitInputsIntoSelfAndDependencies(
        ['^{projectRoot}/**/*.ts'],
        {}
      );
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.ts', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should identify ^{workspaceRoot}/tools/**/* as a dependency fileset', () => {
      const result = splitInputsIntoSelfAndDependencies(
        ['^{workspaceRoot}/tools/**/*'],
        {}
      );
      expect(result.depsFilesets).toEqual([
        { fileset: '{workspaceRoot}/tools/**/*', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should identify ^namedInput as a named input reference (regression test)', () => {
      const result = splitInputsIntoSelfAndDependencies(['^production'], {
        production: ['{projectRoot}/**/*.ts', '!{projectRoot}/**/*.spec.ts'],
      });
      expect(result.depsInputs).toEqual([
        { input: 'production', dependencies: true },
      ]);
      expect(result.depsFilesets).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should handle { fileset: "...", dependencies: true } object form', () => {
      const result = splitInputsIntoSelfAndDependencies(
        [{ fileset: '{projectRoot}/**/*.ts', dependencies: true }],
        {}
      );
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.ts', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should handle mixed inputs correctly', () => {
      const result = splitInputsIntoSelfAndDependencies(
        [
          '{projectRoot}/**/*.ts', // self input
          '^{projectRoot}/**/*.json', // dependency fileset
          '^production', // dependency named input
          { fileset: '{workspaceRoot}/config/*', dependencies: true }, // object form dependency fileset
          { input: 'default', dependencies: true }, // object form dependency named input
        ],
        {
          production: ['{projectRoot}/**/*.ts'],
        }
      );

      expect(result.selfInputs).toEqual([{ fileset: '{projectRoot}/**/*.ts' }]);
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.json', dependencies: true },
        { fileset: '{workspaceRoot}/config/*', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([
        { input: 'production', dependencies: true },
        { input: 'default', dependencies: true },
      ]);
    });

    it('should not treat ^{projectRoot} filesets as named inputs', () => {
      // Verify that ^{projectRoot}/**/*.ts is not expanded as if it were a named input
      const result = splitInputsIntoSelfAndDependencies(
        ['^{projectRoot}/**/*.ts'],
        {
          // Even if there's a named input that could theoretically match, it shouldn't be used
          '{projectRoot}/**/*.ts': ['{projectRoot}/src/**/*.ts'],
        }
      );

      // Should be a depsFileset, not expanded via namedInputs
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.ts', dependencies: true },
      ]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should treat ^!{projectRoot} as a named input reference (not a dependency fileset)', () => {
      // Note: Negated patterns like ^!{projectRoot}/**/*.spec.ts are currently
      // treated as named input references because after stripping the ^,
      // the rest (!{projectRoot}...) doesn't start with {projectRoot} or {workspaceRoot}
      const result = splitInputsIntoSelfAndDependencies(
        ['^!{projectRoot}/**/*.spec.ts'],
        {}
      );
      // This is treated as a named input reference, not a dependency fileset
      expect(result.depsInputs).toEqual([
        { input: '!{projectRoot}/**/*.spec.ts', dependencies: true },
      ]);
      expect(result.depsFilesets).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should handle multiple dependency filesets in one inputs array', () => {
      const result = splitInputsIntoSelfAndDependencies(
        [
          '^{projectRoot}/**/*.ts',
          '^{projectRoot}/**/*.json',
          '^{workspaceRoot}/shared/**/*',
        ],
        {}
      );
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.ts', dependencies: true },
        { fileset: '{projectRoot}/**/*.json', dependencies: true },
        { fileset: '{workspaceRoot}/shared/**/*', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
      expect(result.selfInputs).toEqual([]);
    });

    it('should handle self and dependency filesets together', () => {
      const result = splitInputsIntoSelfAndDependencies(
        [
          '{projectRoot}/**/*.ts', // self input
          '^{projectRoot}/**/*.ts', // dependency fileset (same pattern but for deps)
        ],
        {}
      );
      expect(result.selfInputs).toEqual([{ fileset: '{projectRoot}/**/*.ts' }]);
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.ts', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
    });

    it('should handle empty namedInputs (undefined equivalent)', () => {
      const result = splitInputsIntoSelfAndDependencies(
        ['{projectRoot}/**/*.ts', '^{projectRoot}/**/*.json'],
        {}
      );
      expect(result.selfInputs).toEqual([{ fileset: '{projectRoot}/**/*.ts' }]);
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.json', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
    });

    it('should treat { fileset: "..." } without dependencies as a self input', () => {
      const result = splitInputsIntoSelfAndDependencies(
        [{ fileset: '{projectRoot}/**/*.ts' }],
        {}
      );
      // When dependencies is not specified, it should be treated as a self input
      expect(result.selfInputs).toEqual([{ fileset: '{projectRoot}/**/*.ts' }]);
      expect(result.depsFilesets).toEqual([]);
      expect(result.depsInputs).toEqual([]);
    });

    it('should treat object form without dependencies property as a self input (not a dependency fileset)', () => {
      // Verify that the object form { fileset: ... } without dependencies: true
      // is NOT treated as a dependency fileset
      const result = splitInputsIntoSelfAndDependencies(
        [
          { fileset: '{projectRoot}/**/*.ts' }, // no dependencies property
          { fileset: '{projectRoot}/**/*.json', dependencies: true }, // explicit dependencies: true
        ],
        {}
      );
      // The first should be a self input, the second should be a deps fileset
      expect(result.selfInputs).toEqual([{ fileset: '{projectRoot}/**/*.ts' }]);
      expect(result.depsFilesets).toEqual([
        { fileset: '{projectRoot}/**/*.json', dependencies: true },
      ]);
      expect(result.depsInputs).toEqual([]);
    });
  });

  describe('getDependenciesWithOutputsToHash', () => {
    const task = (id: string, outputs: string[]) => {
      const [project, target] = id.split(':');
      return { id, target: { project, target }, outputs } as any;
    };
    const graph = (
      tasks: any[],
      dependencies: Record<string, string[]>
    ): any => ({
      roots: [],
      tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
      dependencies,
      continuousDependencies: {},
    });
    const projectGraph = (inputs: any[] | undefined): any => ({
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: {
            root: 'app',
            targets: { build: { ...(inputs ? { inputs } : {}) } },
          },
        },
      },
      dependencies: {},
    });
    const nxJson: any = { namedInputs: {} };
    const app = task('app:build', ['dist/app']);
    const depsOutputs = (transitive?: boolean) =>
      projectGraph([{ dependentTasksOutputFiles: '**/*.d.ts', transitive }]);

    it('returns nothing when the task has no dependentTasksOutputFiles input', () => {
      const tg = graph([app, task('lib:build', ['dist/lib'])], {
        'app:build': ['lib:build'],
        'lib:build': [],
      });
      expect(
        getDependenciesWithOutputsToHash(
          app,
          tg,
          projectGraph([{ fileset: '{projectRoot}/**/*' }]),
          nxJson
        )
      ).toEqual([]);
    });

    it('skips dependencies that declare no outputs', () => {
      const tg = graph(
        [app, task('tool:install', []), task('lib:build', ['dist/lib'])],
        {
          'app:build': ['tool:install', 'lib:build'],
          'tool:install': [],
          'lib:build': [],
        }
      );
      expect(
        getDependenciesWithOutputsToHash(app, tg, depsOutputs(), nxJson)
      ).toEqual(['lib:build']);
    });

    it('only walks direct dependencies unless transitive', () => {
      const tg = graph(
        [app, task('mid:build', []), task('leaf:build', ['dist/leaf'])],
        {
          'app:build': ['mid:build'],
          'mid:build': ['leaf:build'],
          'leaf:build': [],
        }
      );
      expect(
        getDependenciesWithOutputsToHash(app, tg, depsOutputs(false), nxJson)
      ).toEqual([]);
      expect(
        getDependenciesWithOutputsToHash(app, tg, depsOutputs(true), nxJson)
      ).toEqual(['leaf:build']);
    });

    it('visits diamond dependencies once', () => {
      const tg = graph(
        [
          app,
          task('a:build', ['dist/a']),
          task('b:build', ['dist/b']),
          task('shared:build', ['dist/shared']),
        ],
        {
          'app:build': ['a:build', 'b:build'],
          'a:build': ['shared:build'],
          'b:build': ['shared:build'],
          'shared:build': [],
        }
      );
      expect(
        getDependenciesWithOutputsToHash(app, tg, depsOutputs(true), nxJson)
      ).toEqual(['a:build', 'b:build', 'shared:build']);
    });
  });

  describe('expandNamedInput', () => {
    it('should expand named inputs', () => {
      const expanded = expandNamedInput('c', {
        a: ['a.txt', { fileset: 'myfileset' }],
        b: ['b.txt'],
        c: ['a', { input: 'b' }],
      });
      expect(expanded).toEqual([
        { fileset: 'a.txt' },
        { fileset: 'myfileset' },
        { fileset: 'b.txt' },
      ]);
    });

    it('should throw when an input is not defined"', () => {
      expect(() => expandNamedInput('c', {})).toThrow();
      expect(() =>
        expandNamedInput('b', {
          b: [{ input: 'c' }],
        })
      ).toThrow();
    });

    it('should throw when ^ is used', () => {
      expect(() =>
        expandNamedInput('b', {
          b: ['^c'],
        })
      ).toThrow('namedInputs definitions cannot start with ^');
    });

    it('should treat strings as filesets when no matching inputs', () => {
      const expanded = expandNamedInput('b', {
        b: ['c'],
      });
      expect(expanded).toEqual([{ fileset: 'c' }]);
    });
  });

  describe('expandSingleProjectInputs', () => {
    it('should pass through json inputs unchanged', () => {
      const jsonInput = {
        json: '{workspaceRoot}/tsconfig.base.json',
        fields: ['compilerOptions', 'extends', 'files', 'include'],
      };
      const expanded = expandSingleProjectInputs([jsonInput], {});
      expect(expanded).toEqual([jsonInput]);
    });

    it('should pass through json inputs with excludeFields unchanged', () => {
      const jsonInput = {
        json: '{projectRoot}/package.json',
        excludeFields: ['scripts', 'description'],
      };
      const expanded = expandSingleProjectInputs([jsonInput as any], {});
      expect(expanded).toEqual([jsonInput]);
    });
  });

  describe('filterUsingGlobPatterns', () => {
    it('should OR all positive patterns and AND all negative patterns (when positive and negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        [
          '{projectRoot}/**/*.ts',
          '{projectRoot}/**/*.js',
          '!{projectRoot}/**/*.spec.ts',
          '!{projectRoot}/**/*.md',
        ]
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['!{projectRoot}/**/*.spec.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when positive patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '{projectRoot}/**/*.js']
      );

      expect(filtered.map((f) => f.file)).toEqual([
        'root/a.ts',
        'root/b.js',
        'root/c.spec.ts',
      ]);
    });

    it('should handle projects with the root set to .', () => {
      const filtered = filterUsingGlobPatterns(
        '.',
        [
          { file: 'a.ts' },
          { file: 'b.md' },
          { file: 'dir/a.ts' },
          { file: 'dir/b.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['a.ts', 'dir/a.ts']);
    });
  });
});
