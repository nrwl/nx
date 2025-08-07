import { getExampleForSchema } from './get-schema-example-content';
import {
  getPropertyDefault,
  getPropertyType,
  type PluginItem,
  type PluginMigrationItem,
} from './plugin-schema-parser';

export function generateMigrationItem(name: string, item: any): string {
  const { config } = item;
  let markdown = `\n#### \`${name}\`\n`;

  if (config.description) {
    markdown += `${config.description}\n\n`;
  }

  return markdown;
}

export function generatePackageUpdateItem(item: any): string {
  const { config } = item;
  let markdown = `\n#### Package Updates for ${config.name}\n`;

  if (config.packages && Object.keys(config.packages).length > 0) {
    markdown += `\nThe following packages will be updated:\n\n`;
    markdown += `| Package | Version |\n`;
    markdown += `|---------|----------|\n`;

    for (const [packageName, packageConfig] of Object.entries(
      config.packages
    ) as [string, any][]) {
      markdown += `| \`${packageName}\` | \`${packageConfig.version}\` |\n`;
    }

    markdown += `\n`;
  }

  return markdown;
}

export function getMigrationsMarkdown(
  pluginName: string,
  items: Map<string, PluginMigrationItem>
): string {
  const packageName = `@nx/${pluginName}`;

  let markdown = `
  The ${packageName} plugin provides various migrations to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available migrations and their options.
`;

  // Group migrations by major.minor version
  const versionGroups = new Map<string, Array<{ name: string; item: any }>>();

  for (const [name, item] of items.entries()) {
    const fullVersion = item.config.version || 'unknown';
    // Extract major.minor from version (e.g., "21.2.3-beta.1" -> "21.2")
    const majorMinorMatch = fullVersion.match(/^(\d+)\.(\d+)/);
    const majorMinor = majorMinorMatch
      ? `${majorMinorMatch[1]}.${majorMinorMatch[2]}`
      : fullVersion;

    if (!versionGroups.has(majorMinor)) {
      versionGroups.set(majorMinor, []);
    }
    versionGroups.get(majorMinor)!.push({ name, item });
  }

  // Sort versions by descending order (highest first)
  const sortedVersions = Array.from(versionGroups.keys()).sort((a, b) => {
    // Handle major.minor version comparison
    const parseVersion = (version: string) => {
      const match = version.match(/^(\d+)\.(\d+)/);
      if (!match) return [0, 0];
      return [parseInt(match[1]), parseInt(match[2])];
    };

    const [aMajor, aMinor] = parseVersion(a);
    const [bMajor, bMinor] = parseVersion(b);

    // Compare major, minor in descending order
    if (bMajor !== aMajor) return bMajor - aMajor;
    if (bMinor !== aMinor) return bMinor - aMinor;

    // If versions are equal, fall back to string comparison
    return b.localeCompare(a);
  });

  for (const version of sortedVersions) {
    const items = versionGroups.get(version)!;
    markdown += `\n## ${version}.x\n`;

    // Combine all items without sub-headers
    const generators = items.filter(({ item }) => item.type === 'generator');
    const packageUpdates = items.filter(
      ({ item }) => item.type === 'packageJsonUpdate'
    );

    // Add generators first
    for (const { name, item } of generators) {
      markdown += generateMigrationItem(name, item);
    }

    // Add package updates
    for (const { item } of packageUpdates) {
      markdown += generatePackageUpdateItem(item);
    }
  }

  return markdown;
}

export function getGeneratorsMarkdown(
  pluginName: string,
  items: Map<string, PluginItem>
): string {
  const packageName = `@nx/${pluginName}`;

  let markdown = `
  The ${packageName} plugin provides various generators to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available generators and their options.
`;

  // Sort items alphabetically
  const sortedItems = Array.from(items.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [name, { config, schema, schemaPath }] of sortedItems) {
    const fullItemName = `${packageName}:${name}`;

    markdown += `
## \`${name}\`
`;

    if (schema?.description || config?.description) {
      markdown += `${schema?.description || config?.description}\n\n`;
    }

    if (schema?.examplesFile) {
      const exampleContent = getExampleForSchema(schemaPath, schema)?.trim();
      markdown += exampleContent ? `${exampleContent}\n\n` : '';
    }

    markdown += `**Usage:**
\`\`\`bash
nx generate ${fullItemName} [options]
\`\`\`
`;

    if (config?.aliases && config.aliases.length > 0) {
      markdown += `
**Aliases:** ${config.aliases.map((a: string) => `\`${a}\``).join(', ')}
`;
    }

    if (!schema) continue;

    // Positional arguments (usually the first required property)
    const required = schema.required || [];
    const properties = schema.properties || {};

    // Check for properties with $default.$source === 'argv'
    const positionalArgs: string[] = [];
    for (const [propName, prop] of Object.entries(properties) as [
      string,
      any
    ][]) {
      if (
        prop.$default &&
        prop.$default.$source === 'argv' &&
        typeof prop.$default.index === 'number'
      ) {
        positionalArgs[prop.$default.index] = propName;
      }
    }

    if (positionalArgs.length > 0) {
      markdown += `
**Arguments:**
\`\`\`bash
nx generate ${fullItemName} ${positionalArgs
        .map((arg) => `<${arg}>`)
        .join(' ')} [options]
\`\`\`
`;
    }

    if (Object.keys(properties).length > 0) {
      markdown += `
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|`;

      // Sort properties alphabetically, but put required ones first
      const sortedProperties = Object.entries(properties).sort(([a], [b]) => {
        const aRequired = required.includes(a);
        const bRequired = required.includes(b);

        if (aRequired && !bRequired) return -1;
        if (!aRequired && bRequired) return 1;

        return a.localeCompare(b);
      });

      for (const [propName, property] of sortedProperties as [string, any][]) {
        // Skip positional arguments from the options table
        if (positionalArgs.includes(propName)) {
          continue;
        }

        const type = getPropertyType(property);
        const description = property.description || '';
        const defaultValue = getPropertyDefault(property);
        const isRequired = required.includes(propName);

        let optionName = `\`--${propName}\``;

        if (isRequired) {
          optionName += '[**required**]';
        }

        markdown += `\n| ${optionName} | ${type} | ${description} | ${defaultValue} |`;
      }

      markdown += '\n';
    }
  }

  markdown += `
     ## Getting Help

     You can get help for any generator by adding the \`--help\` flag:

     \`\`\`bash
     nx generate ${packageName}:<generator> --help
     \`\`\`
     `;
  return markdown;
}

export function getExecutorsMarkdown(
  pluginName: string,
  items: Map<string, any>
): string {
  const packageName = `@nx/${pluginName}`;

  let markdown = `
  The ${packageName} plugin provides various executors to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available executors and their options.
`;

  // Sort items alphabetically
  const sortedItems = Array.from(items.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [name, { config, schema, schemaPath }] of sortedItems) {
    markdown += `
### \`${name}\`
`;

    if (schema?.description || config?.description) {
      markdown += `${schema?.description || config?.description}\n\n`;
    }

    if (schema?.examplesFile) {
      markdown += getExampleForSchema(schemaPath, schema);
    }

    markdown += `**Usage:**
\`\`\`bash
nx run project:${name} [options]
\`\`\`
`;

    if (config?.aliases && config.aliases.length > 0) {
      markdown += `
**Aliases:** ${config.aliases.map((a: string) => `\`${a}\``).join(', ')}
`;
    }

    if (!schema) continue;

    // Positional arguments (usually the first required property)
    const required = schema.required || [];
    const properties = schema.properties || {};

    if (Object.keys(properties).length > 0) {
      markdown += `
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|`;

      // Sort properties alphabetically, but put required ones first
      const sortedProperties = Object.entries(properties).sort(([a], [b]) => {
        const aRequired = required.includes(a);
        const bRequired = required.includes(b);

        if (aRequired && !bRequired) return -1;
        if (!aRequired && bRequired) return 1;

        return a.localeCompare(b);
      });

      for (const [propName, property] of sortedProperties as [string, any][]) {
        const type = getPropertyType(property);
        const description = property.description || '';
        const defaultValue = getPropertyDefault(property);
        const isRequired = required.includes(propName);

        let optionName = `\`--${propName}\``;

        if (isRequired) {
          optionName += '[**required**]';
        }

        markdown += `\n| ${optionName} | ${type} | ${description} | ${defaultValue} |`;
      }

      markdown += '\n';
    }

    markdown += `
## Getting Help

You can get help for any executor by adding the \`--help\` flag:

\`\`\`bash
nx run project:executors --help
\`\`\`
`;
  }

  return markdown;
}

type PluginGenerator = {};
