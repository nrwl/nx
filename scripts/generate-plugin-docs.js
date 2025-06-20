#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseGenerators(pluginPath) {
  const generatorsJsonPath = path.join(pluginPath, 'generators.json');
  
  if (!fs.existsSync(generatorsJsonPath)) {
    throw new Error(`generators.json not found at ${generatorsJsonPath}`);
  }

  const generatorsJson = JSON.parse(fs.readFileSync(generatorsJsonPath, 'utf-8'));
  const generators = new Map();

  for (const [name, config] of Object.entries(generatorsJson.generators || {})) {
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

function getPropertyDefault(property) {
  if (property.default !== undefined) {
    if (typeof property.default === 'string') {
      return `\`${property.default}\``;
    }
    return `\`${JSON.stringify(property.default)}\``;
  }
  
  if (property.$default) {
    if (property.$default.$source === 'argv' && property.$default.index !== undefined) {
      return 'From command line';
    }
  }
  
  return '';
}

function generateMarkdown(pluginName, generators) {
  const packageName = `@nx/${pluginName}`;
  let markdown = `---
title: ${packageName} Generators
description: Complete reference for all ${packageName} generator commands
---

# ${packageName} Generators

The ${packageName} plugin provides various generators to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators
`;

  // Sort generators alphabetically
  const sortedGenerators = Array.from(generators.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [name, { config, schema }] of sortedGenerators) {
    const fullGeneratorName = `${packageName}:${name}`;
    
    markdown += `
### \`${name}\`
`;

    if (schema.description || config.description) {
      markdown += `${schema.description || config.description}\n\n`;
    }

    markdown += `**Usage:**
\`\`\`bash
nx generate ${fullGeneratorName} [options]
\`\`\`
`;

    if (config.aliases && config.aliases.length > 0) {
      markdown += `
**Aliases:** ${config.aliases.map(a => `\`${a}\``).join(', ')}
`;
    }

    // Positional arguments (usually the first required property)
    const required = schema.required || [];
    const properties = schema.properties || {};
    
    // Check for properties with $default.$source === 'argv'
    const positionalArgs = [];
    for (const [propName, prop] of Object.entries(properties)) {
      if (prop.$default && prop.$default.$source === 'argv' && typeof prop.$default.index === 'number') {
        positionalArgs[prop.$default.index] = propName;
      }
    }

    if (positionalArgs.length > 0) {
      markdown += `
**Arguments:**
\`\`\`bash
nx generate ${fullGeneratorName} ${positionalArgs.map(arg => `<${arg}>`).join(' ')} [options]
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
        const description = property.description || '';
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
    if (name === 'init' || name === 'configuration' || name === 'component-configuration') {
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
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node generate-plugin-docs.js <plugin-path> [output-dir]');
    console.error('Example: node generate-plugin-docs.js packages/cypress new-nx-dev/docs/api/plugins');
    process.exit(1);
  }

  const pluginPath = args[0];
  const outputBaseDir = args[1] || 'new-nx-dev/docs/api/plugins';
  
  if (!fs.existsSync(pluginPath)) {
    console.error(`Plugin path does not exist: ${pluginPath}`);
    process.exit(1);
  }

  // Extract plugin name from path
  const pluginName = path.basename(pluginPath);
  
  try {
    console.log(`Parsing generators for ${pluginName}...`);
    const generators = parseGenerators(pluginPath);
    
    if (generators.size === 0) {
      console.log(`No generators found for ${pluginName}`);
      return;
    }

    console.log(`Found ${generators.size} generators`);
    
    // Generate markdown
    const markdown = generateMarkdown(pluginName, generators);
    
    // Create output directory
    const outputDir = path.join(outputBaseDir, pluginName);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Write markdown file
    const outputPath = path.join(outputDir, 'generators.md');
    fs.writeFileSync(outputPath, markdown);
    
    console.log(`Generated documentation at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating documentation:', error);
    process.exit(1);
  }
}

main();