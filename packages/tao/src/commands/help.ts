import * as chalk from 'chalk';
import { logger, stripIndent } from '../shared/logger';

export function help() {
  logger.info(
    stripIndent(`
    ${chalk.bold('Nx - Smart, Extensible Build Framework')}
  
    ${chalk.bold('Create a new project.')}
     nx new ${chalk.grey(
       '[project-name] [--collection=collection] [options, ...]'
     )}
    
    ${chalk.bold('Generate code.')}
     nx generate ${chalk.grey('[collection:][generator] [options, ...]')}
     nx g ${chalk.grey('[collection:][generator] [options, ...]')}

    ${chalk.bold('Run target.')}    
     nx run ${chalk.grey('[project][:target][:configuration] [options, ...]')}
     nx r ${chalk.grey('[project][:target][:configuration] [options, ...]')}
    
    You can also use the infix notation to run a target:
     nx [target] [project] [options, ...]

    ${chalk.bold('Migrate packages and create migrations.json.')}
     nx migrate ${chalk.grey('[package-name]')}
    
    ${chalk.bold('Run migrations.')}
     nx migrate ${chalk.grey('--run-migrations=[filename]')}

  `)
  );
  return 0;
}
