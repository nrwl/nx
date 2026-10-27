import type { ProjectGraph } from '@nx/devkit';
import type { FileMapCache } from '@nx/devkit/internal';
import { describe, test } from 'vitest';
import {
  ConformanceTree,
  convertToReadOnly,
  convertToWritable,
} from './conformance-tree';
import type { SuccessfulResolveRuleResultData } from './resolve-rule';
import { conformanceRulesRunner } from './rules-runner';
import type { ConformanceViolation } from './types';

describe('conformanceRulesRunner Benchmarks', () => {
  const NUM_PROJECTS = 1000;
  const NUM_FILES_PER_PROJECT = 5;
  const NUM_VIOLATIONS_PER_FILE = 10;

  let tree: ConformanceTree;
  let projectGraph: ProjectGraph;
  let fileMapCache: FileMapCache;
  let violationheavyRule: SuccessfulResolveRuleResultData;

  const runSetup = async () => {
    tree = new ConformanceTree('/virtual', false);
    tree = convertToWritable(tree);
    tree.write('/package.json', JSON.stringify({ name: 'test-ws' }));
    tree.write('/nx.json', JSON.stringify({}));
    tree.write(
      '/tsconfig.base.json',
      JSON.stringify({ compilerOptions: { paths: {} } })
    );

    const projects: Record<string, { root: string }> = {};
    const projectFileMap: Record<string, { file: string; hash: string }[]> = {};

    for (let i = 0; i < NUM_PROJECTS; i++) {
      const projectName = `proj-${i}`;
      const projectRoot = `libs/${projectName}`;
      projects[projectName] = { root: projectRoot };
      projectFileMap[projectName] = [];

      for (let j = 0; j < NUM_FILES_PER_PROJECT; j++) {
        const filePath = `${projectRoot}/src/file-${j}.ts`;
        tree.write(filePath, `// file content`);
        projectFileMap[projectName].push({ file: filePath, hash: '' });
      }
    }

    projectGraph = {
      nodes: {},
      dependencies: {},
    };

    for (const projectName of Object.keys(projects)) {
      projectGraph.nodes[projectName] = {
        name: projectName,
        type: 'lib',
        data: {
          root: projects[projectName].root,
        },
      };
    }

    fileMapCache = {
      version: '1.0',
      nxVersion: '20.0.0',
      pathMappings: {},
      nxJsonPlugins: [],
      fileMap: {
        projectFileMap,
        nonProjectFiles: [],
      },
    };
    tree = convertToReadOnly(tree);

    violationheavyRule = {
      ruleSpecifier: 'violation-heavy-rule',
      ruleModule: {
        implementation: ({
          projectGraph,
          fileMapCache,
        }: {
          projectGraph: ProjectGraph;
          fileMapCache: FileMapCache;
        }) => {
          const violations: ConformanceViolation[] = [];
          for (const projectName of Object.keys(projectGraph.nodes)) {
            const projectFiles =
              fileMapCache.fileMap.projectFileMap[projectName] || [];
            for (const file of projectFiles) {
              for (let i = 0; i < NUM_VIOLATIONS_PER_FILE; i++) {
                violations.push({
                  message: `Violation ${i} in ${file.file}`,
                  file: file.file,
                  sourceProject: projectName,
                });
              }
            }
          }
          return Promise.resolve({
            severity: 'high' as const,
            details: { violations },
          });
        },
        name: 'violation-heavy-rule',
        category: 'security' as const,
        description:
          'A rule that generates a lot of violations for benchmarking.',
      },
      ruleOptions: {},
    };
  };

  test('should handle a large number of violations efficiently', async ({
    bench,
  }) => {
    await runSetup();

    await bench('conformanceRulesRunner', async () => {
      await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: fileMapCache,
        loadedRules: [violationheavyRule],
        applyFixGenerators: false,
      });
    }).run({ iterations: 10 });
  });
});
