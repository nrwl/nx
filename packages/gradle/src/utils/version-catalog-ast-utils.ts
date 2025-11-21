import { globAsync, Tree } from '@nx/devkit';
import { parseTOML } from 'toml-eslint-parser';
import { gradleProjectGraphPluginName } from './versions';

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

/**
 * Reconstructs TOML content from source text with selective replacements
 * based on AST node ranges. This preserves all original formatting.
 */
function reconstructTomlWithUpdates(
  sourceText: string,
  updates: Array<{ start: number; end: number; replacement: string }>
): string {
  // Sort updates by start position in reverse order to apply from end to beginning
  const sortedUpdates = updates.sort((a, b) => b.start - a.start);

  let result = sourceText;
  for (const update of sortedUpdates) {
    result =
      result.slice(0, update.start) +
      update.replacement +
      result.slice(update.end);
  }

  return result;
}

/**
 * Finds a key-value pair in a TOML table by key name
 */
function findKeyValueInTable(table: any, keyName: string): any | null {
  if (!table.body) return null;

  for (const item of table.body) {
    if (item.type === 'TOMLKeyValue') {
      if (getKeyName(item.key) === keyName) {
        return item;
      }
    }
  }
  return null;
}

/**
 * Gets the string representation of a TOML key
 */
function getKeyName(key: any): string {
  if (key.type === 'TOMLKey' && key.keys && key.keys.length > 0) {
    // Handle TOMLKey type which contains an array of keys (for dotted keys like version.ref)
    return key.keys
      .map((k: any) => {
        if (k.type === 'TOMLBare') {
          return k.name;
        } else if (k.type === 'TOMLQuoted') {
          return k.value;
        }
        return '';
      })
      .join('.');
  } else if (key.type === 'TOMLBare') {
    return key.name;
  } else if (key.type === 'TOMLQuoted') {
    return key.value;
  }
  return '';
}

/**
 * Gets the string value from a TOML value node
 */
function getStringValue(value: any): string | null {
  if (value.type === 'TOMLValue' && value.kind === 'string') {
    return value.value;
  }
  return null;
}

/**
 * Finds plugin configuration in the plugins table
 */
function findPluginConfig(
  pluginsTable: any,
  pluginName: string
): { keyValue: any; format: 'simple' | 'object' } | null {
  if (!pluginsTable.body) return null;

  for (const item of pluginsTable.body) {
    if (item.type === 'TOMLKeyValue') {
      const value = item.value;

      if (value.type === 'TOMLValue' && value.kind === 'string') {
        // Simple format: plugin = "id:version"
        const stringValue = value.value;
        if (stringValue.startsWith(`${pluginName}:`)) {
          return { keyValue: item, format: 'simple' };
        }
      } else if (value.type === 'TOMLInlineTable') {
        // Object format: { id = "plugin.name", version = "1.0.0" }
        const idKeyValue = findKeyValueInTable(value, 'id');
        if (idKeyValue) {
          const idValue = getStringValue(idKeyValue.value);
          if (idValue === pluginName) {
            return { keyValue: item, format: 'object' };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Finds the plugins table in the AST
 */
function findPluginsTable(ast: any): any | null {
  // Look through all top-level elements
  for (const topLevel of ast.body) {
    if (topLevel.type === 'TOMLTopLevelTable') {
      // Look through the body of the top-level table for [plugins] table
      for (const item of topLevel.body) {
        if (item.type === 'TOMLTable' && item.key && item.key.keys) {
          const tableName = item.key.keys
            .map((key: any) => getKeyName(key))
            .join('.');
          if (tableName === 'plugins') {
            return item;
          }
        }
      }

      // If no [plugins] table found, check if there's a plugins key in the root table
      const pluginsKeyValue = findKeyValueInTable(topLevel, 'plugins');
      if (pluginsKeyValue?.value.type === 'TOMLInlineTable') {
        return pluginsKeyValue.value;
      }
    }
  }

  return null;
}

/**
 * Finds the versions table in the AST
 */
function findVersionsTable(ast: any): any | null {
  // Look through all top-level elements
  for (const topLevel of ast.body) {
    if (topLevel.type === 'TOMLTopLevelTable') {
      // Look through the body of the top-level table for [versions] table
      for (const item of topLevel.body) {
        if (item.type === 'TOMLTable' && item.key && item.key.keys) {
          const tableName = item.key.keys
            .map((key: any) => getKeyName(key))
            .join('.');
          if (tableName === 'versions') {
            return item;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Updates a plugin version in a TOML catalog while preserving formatting
 */
export function updatePluginVersionInCatalogAst(
  sourceText: string,
  pluginName: string,
  newVersion: string
): string | null {
  try {
    const ast = parseTOML(sourceText);
    const updates: Array<{ start: number; end: number; replacement: string }> =
      [];

    const pluginsTable = findPluginsTable(ast);
    if (!pluginsTable) {
      return null; // No plugins table found
    }

    const pluginConfig = findPluginConfig(pluginsTable, pluginName);
    if (!pluginConfig) {
      return null; // Plugin not found
    }

    const { keyValue, format } = pluginConfig;

    if (format === 'simple') {
      // Update simple format: "plugin:version" -> "plugin:newVersion"
      const value = keyValue.value;
      const newValue = `${pluginName}:${newVersion}`;

      // Preserve the quote style
      const quote = value.style === 'basic' ? '"' : "'";
      const replacement = `${quote}${newValue}${quote}`;

      updates.push({
        start: value.range[0],
        end: value.range[1],
        replacement,
      });
    } else if (format === 'object') {
      // Handle object format
      const inlineTable = keyValue.value;

      // First, try to find direct version
      const versionKeyValue = findKeyValueInTable(inlineTable, 'version');
      if (versionKeyValue) {
        const versionValue = versionKeyValue.value;
        if (
          versionValue.type === 'TOMLValue' &&
          versionValue.kind === 'string'
        ) {
          // Direct version update
          const quote = versionValue.style === 'basic' ? '"' : "'";
          const replacement = `${quote}${newVersion}${quote}`;

          updates.push({
            start: versionValue.range[0],
            end: versionValue.range[1],
            replacement,
          });
        }
      } else {
        // Check for version.ref pattern - look for either quoted or unquoted key
        let versionRefKeyValue = findKeyValueInTable(
          inlineTable,
          'version.ref'
        );
        if (!versionRefKeyValue) {
          // Try with quotes since TOML inline tables may require quoted keys for dotted keys
          versionRefKeyValue = findKeyValueInTable(
            inlineTable,
            '"version.ref"'
          );
        }

        if (versionRefKeyValue) {
          // This means we need to update the referenced version in the [versions] table
          const refValue = getStringValue(versionRefKeyValue.value);
          if (refValue) {
            const versionsTable = findVersionsTable(ast);
            if (versionsTable) {
              const referencedVersion = findKeyValueInTable(
                versionsTable,
                refValue
              );
              if (referencedVersion) {
                const refVersionValue = referencedVersion.value;
                if (
                  refVersionValue.type === 'TOMLValue' &&
                  refVersionValue.kind === 'string'
                ) {
                  const quote = refVersionValue.style === 'basic' ? '"' : "'";
                  const replacement = `${quote}${newVersion}${quote}`;

                  updates.push({
                    start: refVersionValue.range[0],
                    end: refVersionValue.range[1],
                    replacement,
                  });
                }
              }
            }
          }
        }
      }
    }

    if (updates.length === 0) {
      return null;
    }

    return reconstructTomlWithUpdates(sourceText, updates);
  } catch (error) {
    console.error('Error parsing TOML with AST:', error);
    return null;
  }
}

/**
 * Extracts plugin version from catalog using AST parsing
 */
export function extractPluginVersionFromCatalogAst(
  sourceText: string,
  pluginName: string
): string | null {
  try {
    const ast = parseTOML(sourceText);

    const pluginsTable = findPluginsTable(ast);
    if (!pluginsTable) {
      return null;
    }

    const pluginConfig = findPluginConfig(pluginsTable, pluginName);
    if (!pluginConfig) {
      return null;
    }

    const { keyValue, format } = pluginConfig;

    if (format === 'simple') {
      // Extract from simple format: "plugin:version"
      const value = keyValue.value;
      const stringValue = value.value;
      return stringValue.split(':')[1] || null;
    } else if (format === 'object') {
      // Extract from object format
      const inlineTable = keyValue.value;

      // First, try to find direct version
      const versionKeyValue = findKeyValueInTable(inlineTable, 'version');
      if (versionKeyValue) {
        return getStringValue(versionKeyValue.value);
      }

      // Check for version.ref pattern - look for either quoted or unquoted key
      let versionRefKeyValue = findKeyValueInTable(inlineTable, 'version.ref');
      if (!versionRefKeyValue) {
        // Try with quotes since TOML inline tables may require quoted keys for dotted keys
        versionRefKeyValue = findKeyValueInTable(inlineTable, '"version.ref"');
      }

      if (versionRefKeyValue) {
        const refValue = getStringValue(versionRefKeyValue.value);
        if (refValue) {
          const versionsTable = findVersionsTable(ast);
          if (versionsTable) {
            const referencedVersion = findKeyValueInTable(
              versionsTable,
              refValue
            );
            if (referencedVersion) {
              return getStringValue(referencedVersion.value);
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing TOML with AST:', error);
    return null;
  }
}

/**
 * Updates Nx plugin version in all catalog files using AST-based approach
 */
export async function updateNxPluginVersionInCatalogsAst(
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

    const currentVersion = extractPluginVersionFromCatalogAst(
      content,
      gradleProjectGraphPluginName
    );

    if (currentVersion && currentVersion !== expectedVersion) {
      const updatedContent = updatePluginVersionInCatalogAst(
        content,
        gradleProjectGraphPluginName,
        expectedVersion
      );

      if (updatedContent) {
        tree.write(catalogPath, updatedContent);
        updated = true;
      }
    }
  }

  return updated;
}
