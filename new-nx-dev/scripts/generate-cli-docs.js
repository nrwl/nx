const fs = require('fs');
const path = require('path');

async function generateCLIDocs() {
  console.log('🔍 Analyzing Nx CLI commands...');
  
  // Generate docs by analyzing command files directly
  await generateCLIDocsFromFiles();
}

function generateCLIOverviewPage(cliData, outputDir) {
  const commands = Object.keys(cliData).sort();
  
  const content = `---
title: CLI Commands
description: Complete reference for all Nx CLI commands
---

# Nx CLI Commands

Nx provides a comprehensive set of CLI commands to help you manage your workspace. Below is a complete reference of all available commands.

## Available Commands

${commands.map(cmd => {
  const data = cliData[cmd];
  return `### [\`nx ${cmd}\`](./cli-${cmd})

${data.description || 'No description available'}

\`\`\`bash
nx ${data.command || cmd}
\`\`\`
`;
}).join('\n')}

## Getting Help

You can get help for any command by adding the \`--help\` flag:

\`\`\`bash
nx <command> --help
\`\`\`
`;

  fs.writeFileSync(path.join(outputDir, 'cli.md'), content);
}

function generateCommandPage(commandName, commandData, outputDir) {
  const { command, description, aliases = [], options = {}, examples = [] } = commandData;
  
  // Clean description for YAML frontmatter - remove newlines and problematic characters
  const cleanDescription = (description || `Documentation for the nx ${commandName} command`)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/'/g, "''")     // Escape single quotes for YAML
    .substring(0, 200)       // Truncate very long descriptions
    .trim();
  
  const content = `---
title: nx ${commandName}
description: '${cleanDescription}'
---

# \`nx ${commandName}\`

${description || 'No description available'}

${aliases.length > 0 ? `## Aliases

${aliases.map(alias => `- \`${alias}\``).join('\n')}
` : ''}

## Usage

\`\`\`bash
nx ${command || commandName} [options]
\`\`\`

${Object.keys(options).length > 0 ? generateOptionsSection(options) : ''}

${examples.length > 0 ? generateExamplesSection(examples) : ''}
`;

  fs.writeFileSync(path.join(outputDir, `cli-${commandName}.md`), content);
}

function generateOptionsSection(options) {
  const sortedOptions = Object.entries(options).sort(([a], [b]) => a.localeCompare(b));
  
  return `## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
${sortedOptions.map(([name, option]) => {
  const type = option.type || 'string';
  let description = option.description || 'No description';
  
  // Add alias information
  if (option.alias) {
    description += ` (alias: \`-${option.alias}\`)`;
  }
  
  // Add deprecation warning
  if (option.deprecated) {
    description += ` **⚠️ Deprecated**${option.deprecated !== true ? `: ${option.deprecated.replace(/['"]/g, '')}` : ''}`;
  }
  
  // Add choices if available
  if (option.choices) {
    description += ` (choices: ${option.choices.map(c => `\`${c}\``).join(', ')})`;
  }
  
  const defaultValue = option.default !== undefined ? `\`${option.default}\`` : '';
  
  return `| \`--${name}\` | ${type} | ${description} | ${defaultValue} |`;
}).join('\n')}
`;
}

function generateExamplesSection(examples) {
  return `## Examples

${examples.map(example => `### ${example.description}

\`\`\`bash
${example.command}
\`\`\`
`).join('\n')}
`;
}

function findFiles(dir, filename) {
  const files = [];
  
  function walkDir(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile() && item === filename) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  walkDir(dir);
  return files;
}

function extractOptionsFromContent(content) {
  const options = {};
  
  // Extract with*Options function calls from the entire content
  const withOptionsMatches = content.match(/with\w+(?:Options?)?\(/g) || [];
  
  for (const match of withOptionsMatches) {
    const functionName = match.replace(/with(\w+)(?:Options?)?\(/, '$1').toLowerCase();
    
    // Map common option groups to their likely options
    switch (functionName) {
      case 'verbose':
        options.verbose = {
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false
        };
        break;
      case 'runoptions':
      case 'run':
        Object.assign(options, {
          parallel: { type: 'number', description: 'Max number of parallel processes' },
          runner: { type: 'string', description: 'This is the name of the tasks runner to use' },
          graph: { type: 'string', description: 'Show the task graph of the command' },
          'skip-nx-cache': { type: 'boolean', description: 'Rerun the tasks even when the results are available in the cache' }
        });
        break;
      case 'affectedoptions':
      case 'affected':
        Object.assign(options, {
          base: { type: 'string', description: 'Base of the current branch (usually main)' },
          head: { type: 'string', description: 'Latest commit of the current branch (usually HEAD)' },
          files: { type: 'string', description: 'Change the way Nx is calculating the affected command' },
          uncommitted: { type: 'boolean', description: 'Uncommitted changes' }
        });
        break;
      case 'batch':
        options.batch = {
          type: 'boolean',
          description: 'Run task(s) in batches for executors which support batches',
          default: false
        };
        break;
      case 'configuration':
        options.configuration = {
          type: 'string',
          description: 'This is the configuration to use when performing tasks on projects',
          alias: 'c'
        };
        break;
      case 'outputstyleoption':
      case 'outputstyle':
        options['output-style'] = {
          type: 'string',
          description: 'Defines how Nx emits outputs tasks logs',
          choices: ['dynamic', 'static', 'stream', 'stream-without-prefixes'],
          default: 'dynamic'
        };
        break;
      case 'tuioptions':
      case 'tui':
        Object.assign(options, {
          'nx-bail': { type: 'boolean', description: 'Stop command execution after the first failed task' },
          'nx-ignore-cycles': { type: 'boolean', description: 'Ignore cycles in the task graph' }
        });
        break;
      case 'targetandconfigurationoption':
      case 'targetandconfiguration':
        Object.assign(options, {
          target: { type: 'string', description: 'Task to run for affected projects', alias: 't' },
          configuration: { type: 'string', description: 'This is the configuration to use when performing tasks on projects', alias: 'c' }
        });
        break;
    }
  }
  
  // Look for direct option definitions in the builder
  const optionMatches = content.match(/\.option\(\s*['"`]([^'"`]+)['"`]\s*,\s*{([^}]+)}/g) || [];
  
  for (const match of optionMatches) {
    const optionMatch = match.match(/\.option\(\s*['"`]([^'"`]+)['"`]\s*,\s*{([^}]+)}/);
    if (optionMatch) {
      const optionName = optionMatch[1];
      const optionConfig = optionMatch[2];
      
      const typeMatch = optionConfig.match(/type:\s*['"`]([^'"`]+)['"`]/);
      const describeMatch = optionConfig.match(/describe:\s*['"`]([^'"`]+)['"`]/);
      const defaultMatch = optionConfig.match(/default:\s*([^,}]+)/);
      const aliasMatch = optionConfig.match(/alias:\s*['"`]([^'"`]+)['"`]/);
      const deprecatedMatch = optionConfig.match(/deprecated:\s*(['"`][^'"`]*['"`]|true|false)/);
      
      options[optionName] = {
        type: typeMatch ? typeMatch[1] : 'string',
        description: describeMatch ? describeMatch[1] : 'No description available',
        default: defaultMatch ? defaultMatch[1].trim() : undefined,
        alias: aliasMatch ? aliasMatch[1] : undefined,
        deprecated: deprecatedMatch ? deprecatedMatch[1] : undefined
      };
    }
  }
  
  return options;
}

async function generateCLIDocsFromFiles() {
  console.log('📁 Analyzing command files directly...');
  
  const commandDir = path.join(__dirname, '../../packages/nx/src/command-line');
  const commandFiles = findFiles(commandDir, 'command-object.ts');
  
  const commands = {};
  
  for (const file of commandFiles) {
    try {
      const commandName = path.basename(path.dirname(file));
      
      // Read the file content to extract basic information
      const content = fs.readFileSync(file, 'utf8');
      
      // Extract command information using regex patterns
      const commandMatch = content.match(/command:\s*['"`]([^'"`]+)['"`]/);
      const describeMatch = content.match(/describe:\s*['"`]([^'"`]+)['"`]/);
      const aliasesMatch = content.match(/aliases:\s*\[([^\]]+)\]/);
      
      // Extract options from builder function
      const options = extractOptionsFromContent(content);
      
      commands[commandName] = {
        command: commandMatch ? commandMatch[1] : commandName,
        description: describeMatch ? describeMatch[1] : `The ${commandName} command`,
        aliases: aliasesMatch ? aliasesMatch[1].split(',').map(a => a.trim().replace(/['"`]/g, '')) : [],
        options: options,
        examples: []
      };
      
    } catch (error) {
      console.warn(`⚠️  Could not parse ${file}:`, error.message);
    }
  }
  
  const outputDir = path.join(__dirname, '../docs/api');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  generateCLIOverviewPage(commands, outputDir);
  
  for (const [commandName, commandData] of Object.entries(commands)) {
    generateCommandPage(commandName, commandData, outputDir);
  }
  
  console.log(`✅ Generated documentation for ${Object.keys(commands).length} commands`);
}

// Run the generator
if (require.main === module) {
  generateCLIDocs().catch(console.error);
}

module.exports = { generateCLIDocs };