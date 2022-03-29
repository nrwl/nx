import { getPackageManagerCommand, Tree, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json: any) => {
    json.scripts = {
      ...json.scripts,
      'run-typed-forms': 'node tools/scripts/run-typed-forms.js',
    };
    if (json.dependencies['@angular/forms']) {
      json.dependencies['@angular/forms'] =
        'https://output.circle-artifacts.com/output/job/f35a2f67-f228-4906-b3fe-6af3047479c1/artifacts/0/angular/forms-pr43834-15d86e186e.tgz';
    } else if (json.devDependencies['@angular/forms']) {
      json.devDependencies['@angular/forms'] =
        'https://output.circle-artifacts.com/output/job/f35a2f67-f228-4906-b3fe-6af3047479c1/artifacts/0/angular/forms-pr43834-15d86e186e.tgz';
    } else {
      json.dependencies['@angular/forms'] =
        'https://output.circle-artifacts.com/output/job/f35a2f67-f228-4906-b3fe-6af3047479c1/artifacts/0/angular/forms-pr43834-15d86e186e.tgz';
    }
    return json;
  });
  const pmc = getPackageManagerCommand();

  tree.write(
    'migrations.json',
    `{
    "migrations": [
      {
        "version": "14.0.0-beta.0",
        "implementation": "./schematics/migrations/typed-forms/index",
        "package": "@angular/core",
        "name": "migration-v14-typed-forms"
      }
    ]
  }`
  );

  tree.write(
    'tools/scripts/run-typed-forms.js',
    `const { execSync } = require('child_process');
  async function install() {
    console.log('installing packages');
    execSync('${pmc.install} --force', { stdio: 'ignore' });
  }
  
  async function runTypedMigration() {
    console.log('migrating');
    execSync('${pmc.exec} nx migrate --run-migrations', { stdio: 'pipe' });
  }
  
  async function run() {
    await install();
    await runTypedMigration();
    console.log('complete');
  }
  
  run();
  `
  );
}
