import { Tree, globAsync } from '@nx/devkit';
import { gradleProjectGraphPluginName } from './versions';

export async function findVersionCatalogFiles(tree: Tree): Promise<string[]> {
  const versionCatalogPaths: string[] = [];

  tree.listChanges().forEach((change) => {
    if (change.path.match(/gradle\/.*\.versions\.toml$/)) {
      versionCatalogPaths.push(change.path);
    }
  });

  const globFiles = await globAsync(tree, ['**/gradle/*.versions.toml']);
  for (const filePath of globFiles) {
    if (!versionCatalogPaths.includes(filePath)) {
      versionCatalogPaths.push(filePath);
    }
  }

  return versionCatalogPaths;
}

export function updatePluginVersionInCatalog(
  catalogContent: string,
  pluginName: string,
  newVersion: string
): string {
  const lines = catalogContent.split('\n');
  let inVersionsSection = false;
  let inPluginsSection = false;
  let versionRefName: string | null = null;

  // First pass: find version.ref name if using one
  for (const line of lines) {
    if (line.trim().startsWith('[versions]')) {
      inVersionsSection = true;
      inPluginsSection = false;
    } else if (line.trim().startsWith('[plugins]')) {
      inPluginsSection = true;
      inVersionsSection = false;
    } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      inVersionsSection = false;
      inPluginsSection = false;
    }

    if (inPluginsSection && line.includes(pluginName)) {
      const versionRefMatch = line.match(/version\.ref\s*=\s*["']([^"']+)["']/);
      if (versionRefMatch) {
        versionRefName = versionRefMatch[1];
        break;
      }
    }
  }

  // Second pass: update the content
  inVersionsSection = false;
  inPluginsSection = false;

  return lines
    .map((line) => {
      if (line.trim().startsWith('[versions]')) {
        inVersionsSection = true;
        inPluginsSection = false;
      } else if (line.trim().startsWith('[plugins]')) {
        inPluginsSection = true;
        inVersionsSection = false;
      } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
        inVersionsSection = false;
        inPluginsSection = false;
      }

      // Update in versions section if we have a version.ref
      if (inVersionsSection && versionRefName) {
        const escapedRefName = versionRefName.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );
        const versionRefPattern = new RegExp(
          `^(\\s*${escapedRefName}\\s*=\\s*["'])([^"']+)(["'])(.*)$`
        );
        if (versionRefPattern.test(line)) {
          return line.replace(versionRefPattern, `$1${newVersion}$3$4`);
        }
      }

      // Update in plugins section for direct version
      if (inPluginsSection && line.includes(pluginName)) {
        // Handle direct version in object format: version = "1.0.0"
        const directVersionPattern = /(\bversion\s*=\s*["'])([^"']+)(["'])/;
        if (directVersionPattern.test(line) && line.includes(pluginName)) {
          return line.replace(directVersionPattern, `$1${newVersion}$3`);
        }

        // Handle simple plugin format: plugin = "id:version"
        const escapedPluginName = pluginName.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );
        const simpleVersionPattern = new RegExp(
          `(["']${escapedPluginName}:)([^"']+)(["'])`
        );
        if (simpleVersionPattern.test(line)) {
          return line.replace(simpleVersionPattern, `$1${newVersion}$3`);
        }
      }

      return line;
    })
    .join('\n');
}

export function hasPluginInCatalog(
  catalogContent: string,
  pluginName: string
): boolean {
  const pluginIdPattern = new RegExp(
    `id\\s*=\\s*["']${pluginName.replace(/\./g, '\\.')}["']`
  );

  const simplePluginPattern = new RegExp(
    `=\\s*["']${pluginName.replace(/\./g, '\\.')}:`
  );

  return (
    pluginIdPattern.test(catalogContent) ||
    simplePluginPattern.test(catalogContent)
  );
}

export function extractPluginVersionFromCatalog(
  catalogContent: string,
  pluginName: string
): string | null {
  const lines = catalogContent.split('\n');
  let inVersionsSection = false;
  let inPluginsSection = false;
  let versionRefName: string | null = null;

  // First pass: find if plugin uses version.ref or direct version
  for (const line of lines) {
    if (line.trim().startsWith('[versions]')) {
      inVersionsSection = true;
      inPluginsSection = false;
    } else if (line.trim().startsWith('[plugins]')) {
      inPluginsSection = true;
      inVersionsSection = false;
    } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      inVersionsSection = false;
      inPluginsSection = false;
    }

    if (inPluginsSection) {
      const pluginMatch = line.match(
        new RegExp(`id\\s*=\\s*["']${pluginName.replace(/\./g, '\\.')}["']`)
      );

      if (pluginMatch) {
        const versionRefMatch = line.match(
          /version\.ref\s*=\s*["']([^"']+)["']/
        );
        const directVersionMatch = line.match(/version\s*=\s*["']([^"']+)["']/);

        if (versionRefMatch) {
          versionRefName = versionRefMatch[1];
          break;
        } else if (directVersionMatch) {
          return directVersionMatch[1];
        }
      }

      const simplePluginMatch = line.match(
        new RegExp(`=\\s*["']${pluginName.replace(/\./g, '\\.')}:([^"']+)["']`)
      );

      if (simplePluginMatch) {
        return simplePluginMatch[1];
      }
    }
  }

  // Second pass: if we found a version.ref, look for the version value
  if (versionRefName) {
    inVersionsSection = false;
    inPluginsSection = false;

    for (const line of lines) {
      if (line.trim().startsWith('[versions]')) {
        inVersionsSection = true;
        inPluginsSection = false;
      } else if (line.trim().startsWith('[plugins]')) {
        inPluginsSection = true;
        inVersionsSection = false;
      } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
        inVersionsSection = false;
        inPluginsSection = false;
      }

      if (inVersionsSection) {
        const versionMatch = line.match(
          new RegExp(
            `^\\s*${versionRefName.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            )}\\s*=\\s*["']([^"']+)["']`
          )
        );

        if (versionMatch) {
          return versionMatch[1];
        }
      }
    }
  }

  return null;
}

export async function updateNxPluginVersionInCatalogs(
  tree: Tree,
  expectedVersion: string
): Promise<boolean> {
  const catalogFiles = await findVersionCatalogFiles(tree);
  let updated = false;

  for (const catalogPath of catalogFiles) {
    if (!tree.exists(catalogPath)) {
      continue;
    }

    const content = tree.read(catalogPath, 'utf-8');
    if (!content) {
      continue;
    }

    if (hasPluginInCatalog(content, gradleProjectGraphPluginName)) {
      const currentVersion = extractPluginVersionFromCatalog(
        content,
        gradleProjectGraphPluginName
      );

      if (currentVersion && currentVersion !== expectedVersion) {
        const updatedContent = updatePluginVersionInCatalog(
          content,
          gradleProjectGraphPluginName,
          expectedVersion
        );
        tree.write(catalogPath, updatedContent);
        updated = true;
      }
    }
  }

  return updated;
}