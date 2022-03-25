import * as chalk from 'chalk';
import { execSync } from 'child_process';
import { generateCLIDocumentation } from './generate-cli-data';
import { generateDevkitDocumentation } from './generate-devkit-documentation';
import { generatePackageSchemas } from './package-schemas/generatePackageSchemas';

async function generate() {
  try {
    console.log(`${chalk.blue('i')} Generating Documentation`);
    generatePackageSchemas();
    generateDevkitDocumentation();
    await generateCLIDocumentation();

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

generate().then(() => {
  checkDocumentation();
});

function printInfo(
  str: string,
  newLine: boolean = true,
  newLineAfter: boolean = true
) {
  console.log(
    `${newLine ? '\n' : ''}${chalk.blue('i')} ${str}${newLineAfter ? '\n' : ''}`
  );
}
