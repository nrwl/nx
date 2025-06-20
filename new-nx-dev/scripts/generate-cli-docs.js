const fs = require('fs');
const path = require('path');
const { tsquery } = require('@phenomnomnominal/tsquery');

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
  let section = `### \`nx ${cmd}\`

${data.description || 'No description available'}

${data.aliases && data.aliases.length > 0 ? `**Aliases:** ${data.aliases.map(alias => `\`${alias}\``).join(', ')}

` : ''}**Usage:**
\`\`\`bash
nx ${data.command || cmd}
\`\`\`
`;

  // Add options table if there are options
  if (data.options && Object.keys(data.options).length > 0) {
    section += '\n' + generateOptionsSection(data.options) + '\n';
  }

  return section;
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
  
  return `#### Options

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

function extractCommandDataFromAST(content) {
  try {
    // Parse the TypeScript file into an AST
    const ast = tsquery.ast(content);
    
    // Find all exported variable declarations that match CommandModule pattern
    const commandExports = tsquery(ast, 'VariableDeclaration:has(Identifier[name=/yargs.*Command/])');
    
    const commands = [];
    
    for (const varDecl of commandExports) {
      const commandObj = {};
      
      // Find the object literal expression
      const objectLiteral = tsquery(varDecl, 'ObjectLiteralExpression')[0];
      if (!objectLiteral) continue;
      
      // Extract properties from the object literal
      const properties = tsquery(objectLiteral, 'PropertyAssignment');
      
      for (const property of properties) {
        const propertyName = property.name?.escapedText || property.name?.text;
        
        if (propertyName === 'command') {
          // Extract command string
          const commandValue = property.initializer?.text;
          if (commandValue) {
            commandObj.command = commandValue;
          }
        } else if (propertyName === 'describe') {
          // Extract description
          const describeValue = property.initializer?.text;
          if (describeValue) {
            commandObj.description = describeValue;
          }
        } else if (propertyName === 'aliases') {
          // Extract aliases array
          const aliasesArray = tsquery(property.initializer, 'StringLiteral');
          commandObj.aliases = aliasesArray.map(alias => alias.text);
        } else if (propertyName === 'builder') {
          // Extract options from builder function
          commandObj.options = extractOptionsFromBuilder(property.initializer);
        }
      }
      
      if (commandObj.command) {
        commands.push(commandObj);
      }
    }
    
    return commands;
    
  } catch (error) {
    console.warn('Failed to parse AST:', error.message);
    return [];
  }
}

function extractOptionsFromBuilder(builderNode) {
  const options = {};
  
  if (!builderNode) return options;
  
  // Find all function calls in the builder
  const functionCalls = tsquery(builderNode, 'CallExpression');
  
  for (const call of functionCalls) {
    const expression = call.expression;
    
    if (expression.kind === 208) { // PropertyAccessExpression
      const propertyName = expression.name?.escapedText;
      
      if (propertyName === 'option') {
        // Extract direct .option() calls
        const args = call.arguments;
        if (args && args.length >= 2) {
          const optionName = args[0]?.text;
          const optionConfig = args[1];
          
          if (optionName && optionConfig) {
            options[optionName] = extractOptionConfig(optionConfig);
          }
        }
      } else if (propertyName === 'positional') {
        // Extract .positional() calls
        const args = call.arguments;
        if (args && args.length >= 2) {
          const optionName = args[0]?.text;
          const optionConfig = args[1];
          
          if (optionName && optionConfig) {
            options[optionName] = extractOptionConfig(optionConfig);
          }
        }
      }
    } else if (expression.kind === 80) { // Identifier
      const functionName = expression.escapedText;
      
      // Map with*Options functions to their options
      if (functionName && functionName.startsWith('with')) {
        Object.assign(options, getOptionsForFunction(functionName));
      }
    }
  }
  
  return options;
}

function extractOptionConfig(configNode) {
  const config = {
    type: 'string',
    description: 'No description available'
  };
  
  if (configNode.kind === 210) { // ObjectLiteralExpression
    const properties = tsquery(configNode, 'PropertyAssignment');
    
    for (const prop of properties) {
      const propName = prop.name?.escapedText || prop.name?.text;
      const propValue = prop.initializer;
      
      switch (propName) {
        case 'type':
          config.type = propValue?.text || 'string';
          break;
        case 'describe':
          config.description = propValue?.text || 'No description available';
          break;
        case 'default':
          config.default = propValue?.text || propValue?.kind === 112 ? true : propValue?.kind === 97 ? false : undefined;
          break;
        case 'alias':
          config.alias = propValue?.text;
          break;
        case 'deprecated':
          config.deprecated = propValue?.text || (propValue?.kind === 112 ? true : false);
          break;
        case 'choices':
          if (propValue?.kind === 209) { // ArrayLiteralExpression
            config.choices = tsquery(propValue, 'StringLiteral').map(choice => choice.text);
          }
          break;
      }
    }
  }
  
  return config;
}

function getOptionsForFunction(functionName) {
  const options = {};
  const name = functionName.toLowerCase();
  
  switch (name) {
    case 'withverbose':
      options.verbose = {
        type: 'boolean',
        description: 'Enable verbose logging',
        default: false
      };
      break;
    case 'withrunoptions':
      Object.assign(options, {
        parallel: { type: 'number', description: 'Max number of parallel processes' },
        runner: { type: 'string', description: 'This is the name of the tasks runner to use' },
        graph: { type: 'string', description: 'Show the task graph of the command' },
        'skip-nx-cache': { type: 'boolean', description: 'Rerun the tasks even when the results are available in the cache' }
      });
      break;
    case 'withaffectedoptions':
      Object.assign(options, {
        base: { type: 'string', description: 'Base of the current branch (usually main)' },
        head: { type: 'string', description: 'Latest commit of the current branch (usually HEAD)' },
        files: { type: 'string', description: 'Change the way Nx is calculating the affected command' },
        uncommitted: { type: 'boolean', description: 'Uncommitted changes' }
      });
      break;
    case 'withbatch':
      options.batch = {
        type: 'boolean',
        description: 'Run task(s) in batches for executors which support batches',
        default: false
      };
      break;
    case 'withconfiguration':
      options.configuration = {
        type: 'string',
        description: 'This is the configuration to use when performing tasks on projects',
        alias: 'c'
      };
      break;
    case 'withoutputstyleoption':
      options['output-style'] = {
        type: 'string',
        description: 'Defines how Nx emits outputs tasks logs',
        choices: ['dynamic', 'static', 'stream', 'stream-without-prefixes'],
        default: 'dynamic'
      };
      break;
    case 'withtuioptions':
      Object.assign(options, {
        'nx-bail': { type: 'boolean', description: 'Stop command execution after the first failed task' },
        'nx-ignore-cycles': { type: 'boolean', description: 'Ignore cycles in the task graph' }
      });
      break;
    case 'withtargetandconfigurationoption':
      Object.assign(options, {
        target: { type: 'string', description: 'Task to run for affected projects', alias: 't' },
        configuration: { type: 'string', description: 'This is the configuration to use when performing tasks on projects', alias: 'c' }
      });
      break;
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
      
      // Extract command information using AST parsing
      const commandData = extractCommandDataFromAST(content);
      
      // If AST parsing found commands, use the first one, otherwise fallback to basic info
      if (commandData.length > 0) {
        const cmd = commandData[0];
        commands[commandName] = {
          command: cmd.command || commandName,
          description: cmd.description || `The ${commandName} command`,
          aliases: cmd.aliases || [],
          options: cmd.options || {},
          examples: []
        };
      } else {
        // Fallback to regex patterns if AST parsing fails
        const commandMatch = content.match(/command:\s*['"`]([^'"`]+)['"`]/);
        const describeMatch = content.match(/describe:\s*['"`]([^'"`]+)['"`]/);
        const aliasesMatch = content.match(/aliases:\s*\[([^\]]+)\]/);
        
        commands[commandName] = {
          command: commandMatch ? commandMatch[1] : commandName,
          description: describeMatch ? describeMatch[1] : `The ${commandName} command`,
          aliases: aliasesMatch ? aliasesMatch[1].split(',').map(a => a.trim().replace(/['"`]/g, '')) : [],
          options: {},
          examples: []
        };
      }
      
    } catch (error) {
      console.warn(`⚠️  Could not parse ${file}:`, error.message);
    }
  }
  
  const outputDir = path.join(__dirname, '../docs/api');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Only generate the overview page with all commands included
  generateCLIOverviewPage(commands, outputDir);
  
  console.log(`✅ Generated CLI documentation with ${Object.keys(commands).length} commands`);
}

// Run the generator
if (require.main === module) {
  generateCLIDocs().catch(console.error);
}

module.exports = { generateCLIDocs };