#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// TODO: make this a glob pattern or something so we don't have to manually update
// Define the plugins to generate documentation for
const PLUGIN_PATHS = [
  '../../packages/cypress',
  '../../packages/react',
  '../../packages/next',
  '../../packages/angular',
  '../../packages/vue',
  '../../packages/vite',
  '../../packages/webpack',
  '../../packages/jest',
  '../../packages/eslint',
  '../../packages/storybook',
  '../../packages/playwright',
  '../../packages/rollup',
  '../../packages/esbuild',
  '../../packages/rspack',
  '../../packages/remix',
  '../../packages/expo',
  '../../packages/react-native',
  '../../packages/detox',
  '../../packages/express',
  '../../packages/nest',
  '../../packages/node',
  '../../packages/js',
  '../../packages/web',
  '../../packages/workspace',
  '../../packages/devkit',
  '../../packages/nx',
  '../../packages/plugin',
  '../../packages/nuxt',
  '../../packages/gradle',
];

const OUTPUT_BASE_DIR = 'docs/api/plugins';

function parseGenerators(pluginPath) {
  const generatorsJsonPath = path.join(pluginPath, 'generators.json');

  if (!fs.existsSync(generatorsJsonPath)) {
    return null; // Plugin might not have generators
  }

  const generatorsJson = JSON.parse(
    fs.readFileSync(generatorsJsonPath, 'utf-8')
  );
  const generators = new Map();

  for (const [name, config] of Object.entries(
    generatorsJson.generators || {}
  )) {
    // Skip hidden generators
    if (config.hidden) {
      continue;
    }

    const schemaPath = path.join(pluginPath, config.schema);

    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      generators.set(name, { config, schema });
    }
  }

  return generators;
}

function getPropertyType(property) {
  if (property.type) {
    if (Array.isArray(property.type)) {
      return property.type.join(' | ');
    }
    return property.type;
  }

  if (property.oneOf) {
    return 'string';
  }

  return 'any';
}

function escapeForMdx(str) {
  if (typeof str !== 'string') return str;
  // Escape angle brackets that might be interpreted as JSX
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;');
}

function getPropertyDefault(property) {
  if (property.default !== undefined) {
    if (typeof property.default === 'string') {
      return `\`${escapeForMdx(property.default)}\``;
    }
    return `\`${JSON.stringify(property.default)}\``;
  }

  if (property.$default) {
    if (
      property.$default.$source === 'argv' &&
      property.$default.index !== undefined
    ) {
      return 'From command line';
    }
  }

  return '';
}

function generateMarkdown(pluginName, generators) {
  const packageName = `@nx/${pluginName}`;
  let markdown = `---
title: "${packageName} Generators"
description: "Complete reference for all ${packageName} generator commands"
sidebar_label: Generators
---

# ${packageName} Generators

The ${packageName} plugin provides various generators to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators
`;

  // Sort generators alphabetically
  const sortedGenerators = Array.from(generators.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [name, { config, schema }] of sortedGenerators) {
    const fullGeneratorName = `${packageName}:${name}`;

    markdown += `
### \`${name}\`
`;

    if (schema.description || config.description) {
      markdown += `${escapeForMdx(
        schema.description || config.description
      )}\n\n`;
    }

    markdown += `**Usage:**
\`\`\`bash
nx generate ${fullGeneratorName} [options]
\`\`\`
`;

    if (config.aliases && config.aliases.length > 0) {
      markdown += `
**Aliases:** ${config.aliases.map((a) => `\`${a}\``).join(', ')}
`;
    }

    // Positional arguments (usually the first required property)
    const required = schema.required || [];
    const properties = schema.properties || {};

    // Check for properties with $default.$source === 'argv'
    const positionalArgs = [];
    for (const [propName, prop] of Object.entries(properties)) {
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
nx generate ${fullGeneratorName} ${positionalArgs
        .map((arg) => `&lt;${arg}&gt;`)
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

      for (const [propName, property] of sortedProperties) {
        // Skip positional arguments from the options table
        if (positionalArgs.includes(propName)) {
          continue;
        }

        const type = getPropertyType(property);
        const description = escapeForMdx(property.description || '');
        const defaultValue = getPropertyDefault(property);
        const isRequired = required.includes(propName);

        let optionName = `\`--${propName}\``;
        if (isRequired) {
          optionName += ' **[required]**';
        }

        markdown += `\n| ${optionName} | ${type} | ${description} | ${defaultValue} |`;
      }

      markdown += '\n';
    }

    // Add examples if we can detect common patterns
    if (
      name === 'init' ||
      name === 'configuration' ||
      name === 'component-configuration'
    ) {
      markdown += `
#### Examples

\`\`\`bash
# Initialize ${pluginName} in your workspace
nx generate ${packageName}:init

# Add ${pluginName} configuration to a project
nx generate ${packageName}:configuration --project=my-app
\`\`\`
`;
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

function main() {
  console.log('Generating plugin documentation...');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const relativePath of PLUGIN_PATHS) {
    const pluginPath = path.join(__dirname, relativePath);

    if (!fs.existsSync(pluginPath)) {
      console.log(`⚠️  Skipping ${relativePath} - path does not exist`);
      skipCount++;
      continue;
    }

    // Extract plugin name from path
    const pluginName = path.basename(pluginPath);

    try {
      const generators = parseGenerators(pluginPath);

      if (!generators) {
        console.log(`⚠️  Skipping ${pluginName} - no generators.json found`);
        skipCount++;
        continue;
      }

      if (generators.size === 0) {
        console.log(`⚠️  Skipping ${pluginName} - no visible generators found`);
        skipCount++;
        continue;
      }

      // Generate markdown
      const markdown = generateMarkdown(pluginName, generators);

      // Create output directory
      const outputDir = path.join(__dirname, '..', OUTPUT_BASE_DIR, pluginName);
      fs.mkdirSync(outputDir, { recursive: true });

      // Write markdown file
      const outputPath = path.join(outputDir, 'generators.md');
      fs.writeFileSync(outputPath, markdown);

      console.log(
        `✅ Generated documentation for ${pluginName} (${generators.size} generators)`
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error processing ${pluginName}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  ✅ Successfully generated: ${successCount}`);
  console.log(`  ⚠️  Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
