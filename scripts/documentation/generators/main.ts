import * as chalk from 'chalk';
import { execSync } from 'child_process';
import { removeSync } from 'fs-extra';
import { join, resolve } from 'path';
import { generatePackageSchemas } from '../package-schemas/generatePackageSchemas';
import { generateCliDocumentation } from './generate-cli-data';
import { generateCnwDocumentation } from './generate-cnw-documentation';
import { generateDevkitDocumentation } from './generate-devkit-documentation';
import { generateManifests } from './generate-manifests';

const workspaceRoot = resolve(__dirname, '../../../');

async function generate() {
  try {
    console.log(`${chalk.blue('i')} Generating Documentation`);

    const commandsOutputDirectory = join(
      workspaceRoot,
      'docs',
      'generated',
      'cli'
    );
    removeSync(commandsOutputDirectory);
    await generateCnwDocumentation(commandsOutputDirectory);
    await generateCliDocumentation(commandsOutputDirectory);

    generateDevkitDocumentation();
    await generatePackageSchemas();

    await generateManifests(workspaceRoot);

    console.log(`\n${chalk.green('✓')} Generated Documentation\n`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function checkDocumentation() {
  const output = execSync('git status --porcelain ./docs').toString('utf-8');

  if (output) {
    console.log(
      `${chalk.red(
        '!'
      )} 📄 Documentation has been modified, you need to commit the changes. ${chalk.red(
        '!'
      )} `
    );

    console.log('\nChanged Docs:');
    execSync('git status --porcelain ./docs', { stdio: 'inherit' });

    process.exit(1);
  } else {
    console.log('📄 Documentation not modified');
  }
}

generate().then(() => checkDocumentation());
