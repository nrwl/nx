import { Tree, globAsync } from '@nx/devkit';
import * as TOML from 'smol-toml';
import { gradleProjectGraphPluginName } from './versions';
import { TomlTable } from 'smol-toml';

export async function findVersionCatalogFiles(tree: Tree): Promise<string[]> {
  const versionCatalogPaths: string[] = [];

  const globFiles = await globAsync(tree, ['**/gradle/*.versions.toml']);
  for (const filePath of globFiles) {
    if (!versionCatalogPaths.includes(filePath)) {
      versionCatalogPaths.push(filePath);
    }
  }

  return versionCatalogPaths;
}

export function updatePluginVersionInCatalog(
  catalogContent: TomlTable,
  pluginName: string,
  newVersion: string
): string {
  if (catalogContent.plugins) {
    for (const [pluginAlias, pluginConfig] of Object.entries(
      catalogContent.plugins
    )) {
      if (typeof pluginConfig === 'string') {
        // Handle simple format: plugin = "id:version"
        if (pluginConfig.startsWith(`${pluginName}:`)) {
          catalogContent.plugins[pluginAlias] = `${pluginName}:${newVersion}`;
          break;
        }
      } else if (typeof pluginConfig === 'object' && pluginConfig !== null) {
        // Handle object format: { id = "plugin.name", version = "1.0.0" }
        const config = pluginConfig as any;
        if (config.id === pluginName) {
          if (config.version && typeof config.version === 'string') {
            // Direct version
            config.version = newVersion;
          } else if (
            config.version &&
            typeof config.version === 'object' &&
            config.version.ref &&
            catalogContent.versions
          ) {
            // Version reference in object form: version = { ref = "nx-version" }
            const versionRef = config.version.ref;
            if (catalogContent.versions[versionRef]) {
              catalogContent.versions[versionRef] = newVersion;
            }
          } else if (config['version.ref'] && catalogContent.versions) {
            let versionRef = config['version.ref'];
            // Handle the case where version.ref might be an object with ref property
            if (typeof versionRef === 'object' && versionRef.ref) {
              versionRef = versionRef.ref;
            }
            if (catalogContent.versions[versionRef]) {
              catalogContent.versions[versionRef] = newVersion;
            }
          }
          break;
        }
      }
    }
  }

  return TOML.stringify(catalogContent);
}

export function extractPluginVersionFromCatalog(
  catalogContent: TomlTable,
  pluginName: string
): string | null {
  if (!catalogContent.plugins) {
    return null;
  }

  for (const pluginConfig of Object.values(catalogContent.plugins)) {
    if (typeof pluginConfig === 'string') {
      // Handle simple format: plugin = "id:version"
      if (pluginConfig.startsWith(`${pluginName}:`)) {
        return pluginConfig.split(':')[1];
      }
    } else if (typeof pluginConfig === 'object' && pluginConfig !== null) {
      // Handle object format: { id = "plugin.name", version = "1.0.0" }
      const config = pluginConfig as any;
      if (config.id === pluginName) {
        if (config.version && typeof config.version === 'string') {
          // Direct version
          return config.version;
        } else if (
          config.version &&
          typeof config.version === 'object' &&
          config.version.ref &&
          catalogContent.versions
        ) {
          // Version reference in object form: version = { ref = "nx-version" }
          return catalogContent.versions[config.version.ref] || null;
        } else if (config['version.ref'] && catalogContent.versions) {
          // Version reference - look up the referenced version
          let versionRef = config['version.ref'];
          // Handle the case where version.ref might be an object with ref property
          if (typeof versionRef === 'object' && versionRef.ref) {
            versionRef = versionRef.ref;
          }
          return catalogContent.versions[versionRef] || null;
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

    const parsedToml = TOML.parse(content);
    if (!parsedToml.plugins) {
      continue;
    }

    const currentVersion = extractPluginVersionFromCatalog(
      parsedToml,
      gradleProjectGraphPluginName
    );

    if (currentVersion && currentVersion !== expectedVersion) {
      const updatedContent = updatePluginVersionInCatalog(
        parsedToml,
        gradleProjectGraphPluginName,
        expectedVersion
      );
      tree.write(catalogPath, updatedContent);
      updated = true;
    }
  }

  return updated;
}
