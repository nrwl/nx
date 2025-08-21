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
      const content = `[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.2.3" }`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.2.3');
    });

    it('should extract version from plugin with version.ref', () => {
      const content = `[versions]
nx-version = "2.3.4"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('2.3.4');
    });

    it('should extract version from simple format', () => {
      const content = `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:3.4.5"`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('3.4.5');
    });

    it('should return null if plugin not found', () => {
      const content = `[plugins]
other-plugin = "com.other:1.0.0"`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBeNull();
    });

    it('should handle single quotes in simple format', () => {
      const content = `[plugins]
nx-graph = '${gradleProjectGraphPluginName}:1.5.0'`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.5.0');
    });

    it('should handle single quotes in object format', () => {
      const content = `[plugins]
nx-graph = { id = '${gradleProjectGraphPluginName}', version = '1.5.0' }`;

      const version = extractPluginVersionFromCatalogAst(
        content,
        gradleProjectGraphPluginName
      );
      expect(version).toBe('1.5.0');
    });
  });

  describe('updatePluginVersionInCatalogAst', () => {
    it('should update plugin with direct version while preserving formatting', () => {
      const content = `# This is a comment
[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "1.0.0" }
other = { id = "com.other", version = "2.0.0" }

# Another comment`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain('# This is a comment');
      expect(updated).toContain('# Another comment');
      expect(updated).toContain('version = "1.5.0"');
      expect(updated).toContain('version = "2.0.0"');
      expect(updated).not.toContain('version = "1.0.0"');
      
      // Verify exact whitespace preservation
      const lines = updated!.split('\n');
      expect(lines[0]).toBe('# This is a comment');
      expect(lines[1]).toBe('[plugins]');
      expect(lines[4]).toBe('');
      expect(lines[5]).toBe('# Another comment');
    });

    it('should update plugin with version.ref while preserving formatting', () => {
      const content = `# Version catalog file
[versions]
nx-version = "1.0.0"    # Current Nx version
other-version = "2.0.0"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain('# Version catalog file');
      expect(updated).toContain('# Current Nx version');
      expect(updated).toContain('nx-version = "1.5.0"');
      expect(updated).toContain('other-version = "2.0.0"');
      expect(updated).not.toContain('nx-version = "1.0.0"');

      // Verify that the inline comment is preserved
      expect(updated).toContain('nx-version = "1.5.0"    # Current Nx version');
    });

    it('should update simple format plugin while preserving formatting', () => {
      const content = `# Plugins section
[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"  # Nx plugin
other = "com.other:2.0.0"`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain('# Plugins section');
      expect(updated).toContain(`"${gradleProjectGraphPluginName}:1.5.0"`);
      expect(updated).toContain('com.other:2.0.0');
      expect(updated).not.toContain(':1.0.0"');

      // Verify that the inline comment is preserved
      expect(updated).toContain('# Nx plugin');
    });

    it('should preserve single quotes when updating', () => {
      const content = `[plugins]
nx-graph = '${gradleProjectGraphPluginName}:1.0.0'`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain(`'${gradleProjectGraphPluginName}:1.5.0'`);
      expect(updated).not.toContain('"');
    });

    it('should preserve double quotes when updating', () => {
      const content = `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:1.0.0"`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain(`"${gradleProjectGraphPluginName}:1.5.0"`);
    });

    it('should handle complex formatting with mixed indentation', () => {
      const content = `[versions]
	nx-version = "1.0.0"

[plugins]
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '2.0.0'
      );

      expect(updated).not.toBeNull();
      expect(updated).toContain('nx-version = "2.0.0"');
      
      // Verify original formatting is preserved
      expect(updated).toContain('\tnx-version = "2.0.0"'); // Tab indentation preserved
      expect(updated).toContain('    nx-graph = {'); // Space indentation preserved
    });

    it('should return null if plugin not found', () => {
      const content = `[plugins]
other-plugin = "com.other:1.0.0"`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).toBeNull();
    });

    it('should handle malformed TOML gracefully', () => {
      const content = `[plugins]
invalid syntax here`;

      const updated = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        '1.5.0'
      );

      expect(updated).toBeNull();
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

      const updated = await updateNxPluginVersionInCatalogsAst(tree, '2.0.0');
      expect(updated).toBe(true);

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

      const updated = await updateNxPluginVersionInCatalogsAst(tree, '2.0.0');
      expect(updated).toBe(false);
    });

    it('should return false if plugin not in catalogs', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `[plugins]
other-plugin = "com.other:1.0.0"`,
      });

      const updated = await updateNxPluginVersionInCatalogsAst(tree, '2.0.0');
      expect(updated).toBe(false);
    });

    it('should not update if version is already correct', async () => {
      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': `# Important comment
[plugins]
nx-graph = "${gradleProjectGraphPluginName}:2.0.0"`,
      });

      const originalContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
      const updated = await updateNxPluginVersionInCatalogsAst(tree, '2.0.0');
      expect(updated).toBe(false);

      const finalContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
      expect(finalContent).toBe(originalContent); // No changes made
    });

    it('should preserve all formatting when updating', async () => {
      const originalContent = `# This is an important comment
# Do not remove this header

[versions]
	nx-version = "1.0.0"  # Tab-indented version
    other-lib = "3.0.0"   # Space-indented version

[plugins]
    # Plugin definitions below
    nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-version" }
    other-plugin = "com.example:1.0"

# End of file comment`;

      await tempFs.createFiles({
        'proj/gradle/libs.versions.toml': originalContent,
      });

      const updated = await updateNxPluginVersionInCatalogsAst(tree, '2.5.0');
      expect(updated).toBe(true);

      const updatedContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
      
      // Verify all comments are preserved
      expect(updatedContent).toContain('# This is an important comment');
      expect(updatedContent).toContain('# Do not remove this header');
      expect(updatedContent).toContain('# Tab-indented version');
      expect(updatedContent).toContain('# Space-indented version');
      expect(updatedContent).toContain('# Plugin definitions below');
      expect(updatedContent).toContain('# End of file comment');
      
      // Verify version was updated
      expect(updatedContent).toContain('nx-version = "2.5.0"');
      expect(updatedContent).not.toContain('nx-version = "1.0.0"');
      
      // Verify mixed indentation is preserved
      expect(updatedContent).toContain('\tnx-version = "2.5.0"'); // Tab
      expect(updatedContent).toContain('    other-lib = "3.0.0"'); // Spaces
      expect(updatedContent).toContain('    nx-graph = {'); // Spaces
      
      // Verify exact line structure is maintained
      const originalLines = originalContent.split('\n');
      const updatedLines = updatedContent.split('\n');
      
      expect(updatedLines.length).toBe(originalLines.length);
      expect(updatedLines[0]).toBe(originalLines[0]); // First comment
      expect(updatedLines[1]).toBe(originalLines[1]); // Second comment
      expect(updatedLines[updatedLines.length - 1]).toBe(originalLines[originalLines.length - 1]); // Last comment
    });
  });
});