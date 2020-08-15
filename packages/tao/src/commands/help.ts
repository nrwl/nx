import { tags, terminal } from '@angular-devkit/core';
import { getLogger } from '../shared/logger';
import { commandName, toolDescription } from '../shared/print-help';

export function help() {
  const logger = getLogger(true);

  logger.info(tags.stripIndent`
    ${terminal.bold(toolDescription)}
  
    ${terminal.bold('Create a new project.')}
    ${commandName} new ${terminal.grey(
    '[project-name] [--collection=schematic-collection] [options, ...]'
  )}
    
    ${terminal.bold('Generate code.')}
    ${commandName} generate ${terminal.grey(
    '[schematic-collection:][schematic] [options, ...]'
  )}
    ${commandName} g ${terminal.grey(
    '[schematic-collection:][schematic] [options, ...]'
  )}

    ${terminal.bold('Run target.')}    
    ${commandName} run ${terminal.grey(
    '[project][:target][:configuration] [options, ...]'
  )}
    ${commandName} r ${terminal.grey(
    '[project][:target][:configuration] [options, ...]'
  )}
    
    You can also use the infix notation to run a target:
    ${commandName} [target] [project] [options, ...]

    ${terminal.bold('Migrate packages and create migrations.json.')}
    ${commandName} migrate ${terminal.grey('[package-name]')}
    
    ${terminal.bold('Run migrations.')}
    ${commandName} migrate ${terminal.grey('--run-migrations=[filename]')}

  `);
  return 0;
}
