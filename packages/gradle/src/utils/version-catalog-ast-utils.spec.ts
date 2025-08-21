import { Tree } from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import {
  updatePluginVersionInCatalogAst,
  extractPluginVersionFromCatalogAst,
  updateNxPluginVersionInCatalogsAst,
} from './version-catalog-ast-utils';
import { gradleProjectGraphPluginName } from './versions';

describe('version-catalog-ast-utils', () => {
  let tempFs: TempFs;
  let tree: Tree;

  beforeEach(() => {
    tempFs = new TempFs('test');
    tree = new FsTree(tempFs.tempDir, false);
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  describe('extractPluginVersionFromCatalogAst', () => {
    it('should extract version from plugin with direct version', () => {
      const content = `
[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.2.3" }
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.2.3');
    });

    it('should extract version from plugin with version.ref', () => {
      const content = `
[versions]
nx-version = "2.3.4"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('2.3.4');
    });

    it('should extract version from simple format', () => {
      const content = `
[plugins]
nx-graph = "${gradleProjectGraphPluginName}:3.4.5"
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('3.4.5');
    });

    it('should return null if plugin not found', () => {
      const content = `
[plugins]
other-plugin = "com.other:1.0.0"
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBeNull();
    });

    it('should handle single quotes in simple format', () => {
      const content = `
[plugins]
nx-graph = '${gradleProjectGraphPluginName}:1.5.0'
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.5.0');
    });

    it('should handle single quotes in object format', () => {
      const content = `
[plugins]
nx-graph = { id = '${gradleProjectGraphPluginName}', version = '1.5.0' }
`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.5.0');
    });
  });

  describe('updatePluginVersionInCatalogAst', () => {
    it('should update plugin with direct version while preserving formatting', () => {
      const content = `
# This is a comment
[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.0.0" }
other = { id = "com.other", version = "2.0.0" }

# Another comment
`;
      const expectedResult = `
# This is a comment
[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.5.0" }
other = { id = "com.other", version = "2.0.0" }

# Another comment
`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updatedResult).toEqual(expectedResult);
    });

    it('should update plugin with version.ref while preserving formatting', () => {
      const content = `
# Version catalog file
[versions]
nx-version = "1.0.0"    # Current Nx version
other-version = "2.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
`;
      const expectedResult = `
# Version catalog file
[versions]
nx-version = "1.5.0"    # Current Nx version
other-version = "2.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updatedResult).toEqual(expectedResult);
    });

    it('should preserve single quotes when updating', () => {
      const content = `
[plugins]
nx-graph = '${gradleProjectGraphPluginName}:1.0.0'
`;
      const expectedResult = `
[plugins]
nx-graph = '${gradleProjectGraphPluginName}:1.5.0'
`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updatedResult).toEqual(expectedResult);
    });

    it('should handle complex formatting with mixed indentation', () => {
      const content = `
[versions]
  nx-version = "1.0.0"

[plugins]
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
`;
      const expectedResult = `
[versions]
  nx-version = "2.0.0"

[plugins]
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '2.0.0'
      );

      expect(updatedResult).toEqual(expectedResult);
    });

    it('should return null if plugin not found', () => {
      const content = `
[plugins]
other-plugin = "com.other:1.0.0"
`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updatedResult).toBeNull();
    });

    it('should handle malformed TOML gracefully', () => {
      const content = `[plugins]
invalid syntax here`;

      const updatedResult = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updatedResult).toBeNull();
    });
  });

  describe('updateNxPluginVersionInCatalogsAst', () => {
    it('should update multiple catalog files', async () => {
      await tempFs.createFiles({
        'proj1/gradle/libs.versions.toml': `# Project 1 catalog
[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"`,
        'proj2/gradle/libs.versions.toml': `# Project 2 catalog
[versions]
nx-version = "1.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`,
      });

      const updatedResult = await updateNxPluginVersionInCatalogsAst(
        tree,
        '2.0.0'
      );
      expect(updatedResult).toBe(true);

      const content1 = tree.read('proj1/gradle/libs.versions.toml', 'utf-8');
      const content2 = tree.read('proj2/gradle/libs.versions.toml', 'utf-8');

      expect(content1).toContain('# Project 1 catalog');
      expect(content1).toContain(':2.0.0');
      expect(content1).not.toContain(':1.0.0');

      expect(content2).toContain('# Project 2 catalog');
      expect(content2).toContain('nx-version = "2.0.0"');
      expect(content2).not.toContain('nx-version = "1.0.0"');
    });

    it('should return false if no catalogs found', async () => {
      await tempFs.createFiles({
        'proj/build.gradle': 'plugins {}',
      });

      const updatedResult = await updateNxPluginVersionInCatalogsAst(
        tree,
        '2.0.0'
      );
      expect(updatedResult).toBe(false);
    });

    it('should return false if plugin not in catalogs', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `[plugins]
other-plugin = "com.other:1.0.0"`,
      });

      const updatedResult = await updateNxPluginVersionInCatalogsAst(
        tree,
        '2.0.0'
      );
      expect(updatedResult).toBe(false);
    });

    it('should not update if version is already correct', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `# Important comment
[plugins]
nx-graph = "${gradleProjectGraphPluginName}:2.0.0"`,
      });

      const originalContent = tree.read(
        'proj/gradle/libs.versions.toml',
        'utf-8'
      );
      const updatedResult = await updateNxPluginVersionInCatalogsAst(
        tree,
        '2.0.0'
      );
      expect(updatedResult).toBe(false);

      const finalContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
      expect(finalContent).toBe(originalContent); // No changes made
    });

    it('should preserve all formatting when updating', async () => {
      const originalContent = `
# This is an important comment
# Do not remove this header

[versions]
  nx-version = "1.0.0"  # Tab-indented version
    other-lib = "3.0.0"   # Space-indented version

[plugins]
    # Plugin definitions below
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
    other-plugin = "com.example:1.0"

# End of file comment`;

      const expectedUpdatedContent = `
# This is an important comment
# Do not remove this header

[versions]
  nx-version = "2.5.0"  # Tab-indented version
    other-lib = "3.0.0"   # Space-indented version

[plugins]
    # Plugin definitions below
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
    other-plugin = "com.example:1.0"

# End of file comment`;

      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': originalContent,
      });

      await updateNxPluginVersionInCatalogsAst(tree, '2.5.0');
      const updatedContent = tree.read(
        'proj/gradle/libs.versions.toml',
        'utf-8'
      );

      expect(updatedContent).toBe(expectedUpdatedContent);
    });
  });
});
