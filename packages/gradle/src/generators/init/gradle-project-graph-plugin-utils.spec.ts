import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { Tree } from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import {
  addNxProjectGraphPlugin,
  extractNxPluginVersion,
  updateNxPluginVersion,
} from './gradle-project-graph-plugin-utils';
import { gradleProjectGraphPluginName } from '../../utils/versions';
import * as execGradle from '../../utils/exec-gradle';

jest.mock('../../utils/exec-gradle', () => ({
  findGradlewFile: jest.fn(),
  execGradleAsync: jest.fn(),
}));

const mockFindGradlewFile = execGradle.findGradlewFile as jest.Mock;
const mockExecGradleAsync = execGradle.execGradleAsync as jest.Mock;

describe('Gradle Project Graph Plugin Utils', () => {
  describe('extractNxPluginVersion', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it.each([
      ['id "dev.nx.gradle.project-graph" version "+"', '+'],
      ['id("dev.nx.gradle.project-graph") version("0.1.0")', '0.1.0'],
      ['id(\'dev.nx.gradle.project-graph\') version("0.1.0")', '0.1.0'],
      ["id('dev.nx.gradle.project-graph') version('0.1.0')", '0.1.0'],
    ])('should extract version from %s', async (input, expected) => {
      const version = await extractNxPluginVersion('build.gradle.kts', input);
      expect(version).toBe(expected);
    });

    it('should return version from buildEnvironment fallback if inline version is missing', async () => {
      const gradleEnvOutput = `
      classpath
      \\--- dev.nx.gradle.project-graph:dev.nx.gradle.project-graph.gradle.plugin:0.2.3
           \\--- dev.nx.gradle:project-graph:0.2.3
    `;

      mockFindGradlewFile.mockReturnValue('./gradlew');
      mockExecGradleAsync.mockResolvedValue(gradleEnvOutput);

      const version = await extractNxPluginVersion(
        'build.gradle.kts',
        'some unrelated content'
      );
      expect(version).toBe('0.2.3');
      expect(mockFindGradlewFile).toHaveBeenCalled();
      expect(mockExecGradleAsync).toHaveBeenCalled();
    });

    it('should return null when no version is found anywhere', async () => {
      mockFindGradlewFile.mockImplementation(() => {
        throw new Error('not found');
      });

      const version = await extractNxPluginVersion(
        'build.gradle.kts',
        'no version here'
      );
      expect(version).toBeNull();
    });
  });

  describe('updateNxPluginVersion', () => {
    it('should update version in Groovy DSL format', () => {
      const input = 'id "dev.nx.gradle.project-graph" version "1.0.0"';
      const expected = 'id "dev.nx.gradle.project-graph" version "2.0.0"';
      expect(updateNxPluginVersion(input, '2.0.0')).toBe(expected);
    });

    it('should update version in Kotlin DSL format', () => {
      const input = 'id("dev.nx.gradle.project-graph") version("1.0.0")';
      const expected = 'id("dev.nx.gradle.project-graph") version("2.0.0")';
      expect(updateNxPluginVersion(input, '2.0.0')).toBe(expected);
    });
  });

  describe('addNxProjectGraphPlugin', () => {
    let tempFs: TempFs;
    let cwd: string;
    let tree: Tree;

    beforeEach(async () => {
      tempFs = new TempFs('test');
      cwd = process.cwd();
      process.chdir(tempFs.tempDir);
      tree = new FsTree(tempFs.tempDir, false);
    });

    afterEach(() => {
      jest.resetModules();
      process.chdir(cwd);
    });

    describe('Groovy DSL (build.gradle)', () => {
      it('should add plugin to existing plugins block', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': `plugins {
    id 'java'
}`,
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).toMatch(
          /plugins\s*{\s*id\s*['"]dev\.nx\.gradle\.project-graph['"]\s*version\s*['"][^'"]+['"]\s*id\s*['"]java['"]/
        );
        expect(content).toMatch(
          /allprojects\s*{\s*apply\s*{\s*plugin\(['"]dev\.nx\.gradle\.project-graph['"]\)\s*}\s*}/
        );
      });

      it('should use passed in expected version', async () => {
        const expectedVersion = '2.0.0';
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': `plugins {
    id 'java'
}`,
        });

        await addNxProjectGraphPlugin(tree, expectedVersion);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).toContain(
          `id "${gradleProjectGraphPluginName}" version "${expectedVersion}"`
        );
        expect(content).toMatch(
          /allprojects\s*{\s*apply\s*{\s*plugin\(['"]dev\.nx\.gradle\.project-graph['"]\)\s*}\s*}/
        );
      });

      it('should create plugins block if missing', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': 'apply plugin: "java"',
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).toMatch(
          /^plugins\s*{\s*id\s*['"]dev\.nx\.gradle\.project-graph['"]\s*version\s*['"][^'"]+['"]\s*}\s*apply plugin:/
        );
      });

      it('should update existing plugin version', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': `plugins {
    id "dev.nx.gradle.project-graph" version "1.0.0"
}`,
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).not.toContain('version "1.0.0"');
        expect(content).toContain('allprojects {');
      });
    });

    describe('Kotlin DSL (build.gradle.kts)', () => {
      it('should add plugin to existing plugins block', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle.kts': '',
          'proj/build.gradle.kts': `plugins {
    id("java")
}`,
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle.kts', 'utf-8');
        expect(content).toMatch(
          /plugins\s*{\s*id\(['"]dev\.nx\.gradle\.project-graph['"]\)\s*version\(['"][^'"]+['"]\)\s*id\(['"]java['"]\)/
        );
        expect(content).toMatch(
          /allprojects\s*{\s*apply\s*{\s*plugin\(['"]dev\.nx\.gradle\.project-graph['"]\)\s*}\s*}/
        );
      });

      it('should create plugins block if missing', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle.kts': '',
          'proj/build.gradle.kts': 'apply(plugin = "java")',
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle.kts', 'utf-8');
        expect(content).toMatch(
          /^plugins\s*{\s*id\(['"]dev\.nx\.gradle\.project-graph['"]\)\s*version\(['"][^'"]+['"]\)\s*}\s*apply\(plugin =/
        );
      });
    });

    describe('Multiple projects', () => {
      it('should handle multiple build.gradle files', async () => {
        await tempFs.createFiles({
          'proj1/settings.gradle': '',
          'proj1/build.gradle': 'apply plugin: "java"',
          'proj2/settings.gradle': '',
          'proj2/build.gradle': 'apply plugin: "java"',
        });

        await addNxProjectGraphPlugin(tree);

        const proj1Content = tree.read('proj1/build.gradle', 'utf-8');
        const proj2Content = tree.read('proj2/build.gradle', 'utf-8');

        expect(proj1Content).toContain(`id "${gradleProjectGraphPluginName}"`);
        expect(proj2Content).toContain(`id "${gradleProjectGraphPluginName}"`);
      });

      it('should handle mixed Groovy and Kotlin DSL projects', async () => {
        await tempFs.createFiles({
          'groovy/settings.gradle': '',
          'groovy/build.gradle': 'apply plugin: "java"',
          'kotlin/settings.gradle.kts': '',
          'kotlin/build.gradle.kts': 'apply(plugin = "java")',
        });

        await addNxProjectGraphPlugin(tree);

        const groovyContent = tree.read('groovy/build.gradle', 'utf-8');
        const kotlinContent = tree.read('kotlin/build.gradle.kts', 'utf-8');

        expect(groovyContent).toContain(`id "${gradleProjectGraphPluginName}"`);
        expect(kotlinContent).toContain(
          `id("${gradleProjectGraphPluginName}")`
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle empty build.gradle file', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': '',
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).toMatch(
          /^plugins\s*{\s*id\s*['"]dev\.nx\.gradle\.project-graph['"]\s*version\s*['"][^'"]+['"]\s*}\s*allprojects/
        );
      });

      it('should handle build.gradle with only comments', async () => {
        await tempFs.createFiles({
          'proj/settings.gradle': '',
          'proj/build.gradle': '// Some comments\n// More comments',
        });

        await addNxProjectGraphPlugin(tree);

        const content = tree.read('proj/build.gradle', 'utf-8');
        expect(content).toMatch(
          /^plugins\s*{\s*id\s*['"]dev\.nx\.gradle\.project-graph['"]\s*version\s*['"][^'"]+['"]\s*}\s*\/\/ Some comments/
        );
      });
    });
  });
});
