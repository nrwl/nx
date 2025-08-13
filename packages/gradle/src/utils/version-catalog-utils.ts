import { Tree, globAsync } from '@nx/devkit';
import * as TOML from 'smol-toml';
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
  const toml = TOML.parse(catalogContent);

  // Handle plugins section
  if (toml.plugins) {
    for (const [pluginAlias, pluginConfig] of Object.entries(toml.plugins)) {
      if (typeof pluginConfig === 'string') {
        // Handle simple format: plugin = "id:version"
        if (pluginConfig.startsWith(`${pluginName}:`)) {
          toml.plugins[pluginAlias] = `${pluginName}:${newVersion}`;
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
            toml.versions
          ) {
            // Version reference in object form: version = { ref = "nx-version" }
            const versionRef = config.version.ref;
            if (toml.versions[versionRef]) {
              toml.versions[versionRef] = newVersion;
            }
          } else if (config['version.ref'] && toml.versions) {
            // Version reference - update the referenced version
            let versionRef = config['version.ref'];
            // Handle the case where version.ref might be an object with ref property
            if (typeof versionRef === 'object' && versionRef.ref) {
              versionRef = versionRef.ref;
            }
            if (toml.versions[versionRef]) {
              toml.versions[versionRef] = newVersion;
            }
          }
          break;
        }
      }
    }
  }

  return TOML.stringify(toml);
}

export function hasPluginInCatalog(
  catalogContent: string,
  pluginName: string
): boolean {
  const toml = TOML.parse(catalogContent);

  if (!toml.plugins) {
    return false;
  }

  for (const pluginConfig of Object.values(toml.plugins)) {
    if (typeof pluginConfig === 'string') {
      // Handle simple format: plugin = "id:version"
      if (pluginConfig.startsWith(`${pluginName}:`)) {
        return true;
      }
    } else if (typeof pluginConfig === 'object' && pluginConfig !== null) {
      // Handle object format: { id = "plugin.name", version = "1.0.0" }
      const config = pluginConfig as any;
      if (config.id === pluginName) {
        return true;
      }
    }
  }

  return false;
}

export function extractPluginVersionFromCatalog(
  catalogContent: string,
  pluginName: string
): string | null {
  const toml = TOML.parse(catalogContent);

  if (!toml.plugins) {
    return null;
  }

  for (const pluginConfig of Object.values(toml.plugins)) {
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
          toml.versions
        ) {
          // Version reference in object form: version = { ref = "nx-version" }
          return toml.versions[config.version.ref] || null;
        } else if (config['version.ref'] && toml.versions) {
          // Version reference - look up the referenced version
          let versionRef = config['version.ref'];
          // Handle the case where version.ref might be an object with ref property
          if (typeof versionRef === 'object' && versionRef.ref) {
            versionRef = versionRef.ref;
          }
          return toml.versions[versionRef] || null;
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
