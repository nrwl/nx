import { Tree } from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import {
  findVersionCatalogFiles,
  updatePluginVersionInCatalog,
  hasPluginInCatalog,
  extractPluginVersionFromCatalog,
  updateNxPluginVersionInCatalogs,
} from './version-catalog-utils';
import { gradleProjectGraphPluginName } from './versions';

describe('version-catalog-utils', () => {
  let tempFs: TempFs;
  let tree: Tree;

  beforeEach(() => {
    tempFs = new TempFs('test');
    tree = new FsTree(tempFs.tempDir, false);
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  describe('findVersionCatalogFiles', () => {
    it('should find version catalog files in gradle directory', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': '[versions]',
        'other/gradle/deps.versions.toml': '[versions]',
        'proj/versions.toml': '[versions]',
        'proj/gradle/not-a-catalog.txt': 'text',
      });

      const catalogs = await findVersionCatalogFiles(tree);
      expect(catalogs).toContain('proj/gradle/libs.versions.toml');
      expect(catalogs).toContain('other/gradle/deps.versions.toml');
      expect(catalogs).not.toContain('proj/versions.toml');
      expect(catalogs).not.toContain('proj/gradle/not-a-catalog.txt');
    });
  });

  describe('hasPluginInCatalog', () => {
    it('should detect plugin with id format', () => {
      const content = `[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.0.0" }`;
      
      expect(hasPluginInCatalog(content, gradleProjectGraphPluginName)).toBe(true);
      expect(hasPluginInCatalog(content, 'com.other.plugin')).toBe(false);
    });

    it('should detect plugin with simple format', () => {
      const content = `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"`;
      
      expect(hasPluginInCatalog(content, gradleProjectGraphPluginName)).toBe(true);
      expect(hasPluginInCatalog(content, 'com.other.plugin')).toBe(false);
    });
  });

  describe('extractPluginVersionFromCatalog', () => {
    it('should extract version from plugin with direct version', () => {
      const content = `[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.2.3" }`;
      
      const version = extractPluginVersionFromCatalog(content, gradleProjectGraphPluginName);
      expect(version).toBe('1.2.3');
    });

    it('should extract version from plugin with version.ref', () => {
      const content = `[versions]
nx-version = "2.3.4"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`;
      
      const version = extractPluginVersionFromCatalog(content, gradleProjectGraphPluginName);
      expect(version).toBe('2.3.4');
    });

    it('should extract version from simple format', () => {
      const content = `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:3.4.5"`;
      
      const version = extractPluginVersionFromCatalog(content, gradleProjectGraphPluginName);
      expect(version).toBe('3.4.5');
    });

    it('should return null if plugin not found', () => {
      const content = `[plugins]
other-plugin = "com.other:1.0.0"`;
      
      const version = extractPluginVersionFromCatalog(content, gradleProjectGraphPluginName);
      expect(version).toBeNull();
    });
  });

  describe('updatePluginVersionInCatalog', () => {
    it('should update plugin with direct version', () => {
      const content = `[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.0.0" }
other = { id = "com.other", version = "2.0.0" }`;
      
      const updated = updatePluginVersionInCatalog(content, gradleProjectGraphPluginName, '1.5.0');
      expect(updated).toContain('version = "1.5.0"');
      expect(updated).toContain('version = "2.0.0"');
      expect(updated).not.toContain('version = "1.0.0"');
    });

    it('should update plugin with version.ref', () => {
      const content = `[versions]
nx-version = "1.0.0"
other-version = "2.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`;
      
      const updated = updatePluginVersionInCatalog(content, gradleProjectGraphPluginName, '1.5.0');
      expect(updated).toContain('nx-version = "1.5.0"');
      expect(updated).toContain('other-version = "2.0.0"');
      expect(updated).not.toContain('nx-version = "1.0.0"');
    });

    it('should update simple format plugin', () => {
      const content = `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"
other = "com.other:2.0.0"`;
      
      const updated = updatePluginVersionInCatalog(content, gradleProjectGraphPluginName, '1.5.0');
      expect(updated).toContain(`"${gradleProjectGraphPluginName}:1.5.0"`);
      expect(updated).toContain('com.other:2.0.0');
      expect(updated).not.toContain(':1.0.0"');
    });
  });

  describe('updateNxPluginVersionInCatalogs', () => {
    it('should update multiple catalog files', async () => {
      await tempFs.createFiles({
        'proj1/gradle/libs.versions.toml': `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"`,
        'proj2/gradle/libs.versions.toml': `[versions]
nx-version = "1.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`,
      });

      const updated = await updateNxPluginVersionInCatalogs(tree, '2.0.0');
      expect(updated).toBe(true);

      const content1 = tree.read('proj1/gradle/libs.versions.toml', 'utf-8');
      const content2 = tree.read('proj2/gradle/libs.versions.toml', 'utf-8');
      
      expect(content1).toContain(':2.0.0');
      expect(content2).toContain('nx-version = "2.0.0"');
    });

    it('should return false if no catalogs found', async () => {
      await tempFs.createFiles({
        'proj/build.gradle': 'plugins {}',
      });

      const updated = await updateNxPluginVersionInCatalogs(tree, '2.0.0');
      expect(updated).toBe(false);
    });

    it('should return false if plugin not in catalogs', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `[plugins]
other-plugin = "com.other:1.0.0"`,
      });

      const updated = await updateNxPluginVersionInCatalogs(tree, '2.0.0');
      expect(updated).toBe(false);
    });

    it('should not update if version is already correct', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:2.0.0"`,
      });

      const updated = await updateNxPluginVersionInCatalogs(tree, '2.0.0');
      expect(updated).toBe(false);

      const content = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
      expect(content).toContain(':2.0.0');
    });
  });
});