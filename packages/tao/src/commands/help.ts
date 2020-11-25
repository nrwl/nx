import { tags, terminal } from '@angular-devkit/core';
import { getLogger } from '../shared/logger';

export function help() {
  const logger = getLogger(true);

  logger.info(tags.stripIndent`
    ${terminal.bold('Nx - Extensible Dev Tools for Monorepos.')}
  
    ${terminal.bold('Create a new project.')}
     nx new ${terminal.grey(
       '[project-name] [--collection=collection] [options, ...]'
     )}
    
    ${terminal.bold('Generate code.')}
     nx generate ${terminal.grey('[collection:][generator] [options, ...]')}
     nx g ${terminal.grey('[collection:][generator] [options, ...]')}

    ${terminal.bold('Run target.')}    
     nx run ${terminal.grey(
       '[project][:target][:configuration] [options, ...]'
     )}
     nx r ${terminal.grey('[project][:target][:configuration] [options, ...]')}
    
    You can also use the infix notation to run a target:
     nx [target] [project] [options, ...]

    ${terminal.bold('Migrate packages and create migrations.json.')}
     nx migrate ${terminal.grey('[package-name]')}
    
    ${terminal.bold('Run migrations.')}
     nx migrate ${terminal.grey('--run-migrations=[filename]')}

  `);
  return 0;
}
