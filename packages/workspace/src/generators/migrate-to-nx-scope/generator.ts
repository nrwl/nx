import {
  addProjectConfiguration,
  applyChangesToString,
  ChangeType,
  ExecutorsJson,
  formatFiles,
  generateFiles,
  getProjects,
  MigrationsJson,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  StringChange,
  Tree,
  updateJson,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
  writeJson,
} from '@nx/devkit';
import { basename, extname, join, relative } from 'path';
import {
  createSourceFile,
  ImportDeclaration,
  isStringLiteral,
  ScriptTarget,
  ImportTypeNode,
  isLiteralTypeNode,
  StringLiteral,
  CallExpression,
  ExportDeclaration,
} from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

function migratePackage(
  tree: Tree,
  projectConfiguration: ProjectConfiguration
) {
  const oldPackageJson = readJson(
    tree,
    join(projectConfiguration.root, 'package.json')
  );
  const oldPackageName = oldPackageJson.name;
  const newPackageName = oldPackageJson.name.replace('@nrwl/', '@nx/');

  console.log('Migrating', oldPackageName, '=>', newPackageName);

  fixImports();
  updatePackageJsons();
  changeScope();

  const newProject = createNewProject();
  createNewReadme();
  createNewPackageJson();
  createNewGeneratorsJson();
  createNewExecutorsJson();
  createNewTsConfigs();
  createNewMainFile();
  addDependencyToOldPackage();
  addMigration();

  function changeScope() {
    updateJson(
      tree,
      join(projectConfiguration.root, 'package.json'),
      (json) => {
        json.name = json.name.replace('@nrwl/', '@nx/');
        return json;
      }
    );
  }

  function updatePackageJsons() {
    visitNotIgnoredFiles(tree, '.', (path) => {
      if (path === 'package.json') {
        return;
      }
      if (basename(path) !== 'package.json') {
        return;
      }

      updateJson(tree, path, (json) => {
        for (const deps of [
          json.dependencies,
          json.devDependencies,
          json.optionalDependencies,
          json.peerDependencies,
        ]) {
          if (!deps) {
            continue;
          }
          Object.entries(deps).forEach(([name, version]) => {
            if (name === oldPackageName) {
              deps[newPackageName] = version;
              delete deps[name];
            }
          });
        }
        return json;
      });
    });
  }

  function createNewProject() {
    const newProjectName = projectConfiguration.name + '-legacy';
    const newProjectRoot = projectConfiguration.root.replace(
      'packages/',
      'packages-legacy/'
    );
    addProjectConfiguration(tree, newProjectName, {
      ...projectConfiguration,
      name: newProjectName,
      root: newProjectRoot,
      sourceRoot: newProjectRoot,
      targets: {
        build: {
          executor: '@nrwl/js:tsc',
          dependsOn: ['^build'],
          options: {
            main: join(newProjectRoot, 'index.ts'),
            tsConfig: join(newProjectRoot, 'tsconfig.json'),
            outputPath: 'build/packages/' + newProjectName,
            updateBuildableProjectDepsInPackageJson: false,
            assets: [
              {
                input: newProjectRoot,
                glob: '**/*.json',
                ignore: ['**/tsconfig*.json', 'project.json'],
                output: '/',
              },
              {
                input: newProjectRoot,
                glob: '**/*.d.ts',
                output: '/',
              },
              {
                input: '',
                glob: 'LICENSE',
                output: '/',
              },
            ],
          },
        },
      },
    });

    return readProjectConfiguration(tree, newProjectName);
  }

  function createNewReadme() {
    generateFiles(
      tree,
      join(__dirname, 'files/readme'),
      join(newProject.root),
      {
        oldPackageName,
        newPackageName,
      }
    );
  }

  function createNewPackageJson() {
    writeJson(tree, join(newProject.root, 'package.json'), {
      ...oldPackageJson,
      repository: {
        ...oldPackageJson.repository,
        directory: newProject.root,
      },
      'nx-migrations': {
        migrations: join(newPackageName, 'migrations.json'),
        ...oldPackageJson['nx-migrations'],
      },
      'ng-update': undefined,
      dependencies: {
        [newPackageName]: `file:${relative(
          newProject.root,
          projectConfiguration.root
        )}`,
      },
      devDependencies: undefined,
      peerDependencies: undefined,
      peerDependenciesMeta: undefined,
      optionalDependencies: undefined,
    });
  }

  function createNewGeneratorsJson() {
    const generatorsJsonPath = join(
      projectConfiguration.root,
      'generators.json'
    );

    if (!tree.exists(generatorsJsonPath)) {
      console.log(`${oldPackageName} has no generators`);
      return;
    }
    writeJson(tree, join(newProject.root, 'generators.json'), {
      extends: [newPackageName],
      schematics: {},
    });
  }

  function createNewExecutorsJson() {
    const executorsJsonPath = join(projectConfiguration.root, 'executors.json');

    if (!tree.exists(executorsJsonPath)) {
      console.log(`${oldPackageName} has no executors`);
      return;
    }
    const executorsJson = readJson<ExecutorsJson>(tree, executorsJsonPath);

    function replacePaths(oldPath: string) {
      if (!oldPath) {
        return oldPath;
      }
      return join(newPackageName, oldPath);
    }

    for (const executors of [executorsJson.executors, executorsJson.builders]) {
      for (const executorName in executors) {
        const executor = executors[executorName];

        executor.schema = replacePaths(executor.schema);
        executor.implementation = replacePaths(executor.implementation);
        executor.batchImplementation = replacePaths(
          executor.batchImplementation
        );
        executor.hasher = replacePaths(executor.hasher);
      }
    }

    writeJson(tree, join(newProject.root, 'executors.json'), executorsJson);
  }

  function createNewMainFile() {
    tree.write(
      join(newProject.root, 'index.ts'),
      `export * from '${newPackageName}';`
    );
  }

  function createNewTsConfigs() {
    writeJson(tree, join(newProject.root, 'tsconfig.json'), {
      extends: '../../tsconfig.base.json',
      compilerOptions: {},
      include: ['**/*.ts'],
      files: ['index.ts'],
    });
  }

  function addDependencyToOldPackage() {
    if (
      !('commands' in projectConfiguration.targets.build.options) &&
      'command' in projectConfiguration.targets.build.options
    ) {
      projectConfiguration.targets.build.options = {
        commands: [projectConfiguration.targets.build.options.command],
      };
    }

    projectConfiguration.targets.build.options.commands.push(
      `node ./scripts/add-dependency-to-build.js ${projectConfiguration.name} ${oldPackageName}`
    );

    updateProjectConfiguration(
      tree,
      projectConfiguration.name,
      projectConfiguration
    );
  }

  function fixImports() {
    updateJson(tree, 'tsconfig.base.json', (json) => {
      for (const path in json.compilerOptions.paths) {
        if (path.startsWith(oldPackageName)) {
          json.compilerOptions.paths[
            path.replace(oldPackageName, newPackageName)
          ] = json.compilerOptions.paths[path];
          delete json.compilerOptions.paths[path];
        }
      }
      return json;
    });

    visitNotIgnoredFiles(tree, '.', (path) => {
      if (!['.tsx', '.ts', '.jsx', '.js'].includes(extname(path))) {
        return;
      }

      const originalContents = tree.read(path).toString();

      if (!originalContents.includes(oldPackageName)) {
        return;
      }

      let contents = originalContents
        .replace(
          new RegExp(`require\\(\\s*'${oldPackageName}`, 'g'),
          `require('${newPackageName}`
        )
        .replace(
          new RegExp(
            `ensurePackage(<\\s*.*\\s*>)?\\(\\s*'${oldPackageName}`,
            'g'
          ),
          `ensurePackage$1('${newPackageName}`
        )
        .replace(
          new RegExp(
            `jest.requireActual(<\\s*.*\\s*>)?\\(\\s*'${oldPackageName}`,
            'g'
          ),
          `jest.requireActual$1('${newPackageName}`
        )
        .replace(
          new RegExp(`jest.mock\\(\\s*'${oldPackageName}`, 'g'),
          `jest.mock('${newPackageName}`
        );

      const sourceFile = createSourceFile(path, contents, ScriptTarget.ESNext);
      const changes: StringChange[] = [];

      const typeImports = tsquery.query<ImportTypeNode>(
        sourceFile,
        'ImportType'
      );

      for (const typeImport of typeImports) {
        if (
          isLiteralTypeNode(typeImport.argument) &&
          isStringLiteral(typeImport.argument.literal) &&
          typeImport.argument.literal.text.startsWith(oldPackageName)
        ) {
          const literal = typeImport.argument.literal;
          const newText = literal
            .getFullText(sourceFile)
            .replace(oldPackageName, newPackageName);
          changes.push({
            type: ChangeType.Delete,
            start: literal.getFullStart(),
            length: literal.getFullText(sourceFile).length,
          });
          changes.push({
            type: ChangeType.Insert,
            index: literal.getFullStart(),
            text: newText,
          });
        }
      }

      const imports = tsquery.query<ImportDeclaration>(
        sourceFile,
        'ImportDeclaration'
      );
      for (const imp of imports) {
        const specifier = imp.moduleSpecifier;

        if (
          isStringLiteral(specifier) &&
          specifier.text.startsWith(oldPackageName)
        ) {
          const newText = specifier
            .getFullText(sourceFile)
            .replace(oldPackageName, newPackageName);
          changes.push({
            type: ChangeType.Delete,
            start: specifier.getFullStart(),
            length: specifier.getFullText(sourceFile).length,
          });
          changes.push({
            type: ChangeType.Insert,
            index: specifier.getFullStart(),
            text: newText,
          });
        }
      }

      const exports = tsquery.query<ExportDeclaration>(
        sourceFile,
        'ExportDeclaration'
      );
      for (const exp of exports) {
        const specifier = exp.moduleSpecifier;

        if (
          specifier &&
          isStringLiteral(specifier) &&
          specifier.text.startsWith(oldPackageName)
        ) {
          const newText = specifier
            .getFullText(sourceFile)
            .replace(oldPackageName, newPackageName);
          changes.push({
            type: ChangeType.Delete,
            start: specifier.getFullStart(),
            length: specifier.getFullText(sourceFile).length,
          });
          changes.push({
            type: ChangeType.Insert,
            index: specifier.getFullStart(),
            text: newText,
          });
        }
      }

      const dynamicImports = tsquery.query<CallExpression>(
        sourceFile,
        'CallExpression:has(ImportKeyword)'
      );
      for (const exp of dynamicImports) {
        const firstArgument = exp.arguments[0];

        if (
          firstArgument &&
          isStringLiteral(firstArgument) &&
          firstArgument.text.startsWith(oldPackageName)
        ) {
          const newText = firstArgument
            .getFullText(sourceFile)
            .replace(oldPackageName, newPackageName);
          changes.push({
            type: ChangeType.Delete,
            start: firstArgument.getFullStart(),
            length: firstArgument.getFullText(sourceFile).length,
          });
          changes.push({
            type: ChangeType.Insert,
            index: firstArgument.getFullStart(),
            text: newText,
          });
        }
      }

      if (originalContents !== contents || changes.length > 0) {
        tree.write(path, applyChangesToString(contents, changes));
      }
    });
  }

  function addMigration() {
    const newPackageJson = readJson(
      tree,
      join(projectConfiguration.root, 'package.json')
    );
    const newPackageName = newPackageJson.name;
    const oldPackageName = newPackageJson.name.replace('@nx/', '@nrwl/');

    console.log('Adding migration', oldPackageName, '=>', newPackageName);

    const migrationsJsonPath = join(
      projectConfiguration.root,
      'migrations.json'
    );
    if (!tree.exists(migrationsJsonPath)) {
      writeJson<MigrationsJson>(tree, migrationsJsonPath, {
        version: '0.1',
        generators: {},
        packageJsonUpdates: {},
      });
      updateJson(
        tree,
        join(projectConfiguration.root, 'package.json'),
        (json) => ({
          ...json,
          ['nx-migrations']: {
            migrations: './migrations.json',
          },
        })
      );
    }

    updateJson<MigrationsJson>(tree, migrationsJsonPath, (json) => {
      json.generators ??= {};
      const migrations = json.generators;

      migrations['update-16-0-0-add-nx-packages'] = {
        cli: 'nx',
        version: '16.0.0-beta.1',
        description: `Replace ${oldPackageName} with ${newPackageName}`,
        implementation:
          './src/migrations/update-16-0-0-add-nx-packages/update-16-0-0-add-nx-packages',
      };
      return {
        generators: json.generators,
        schematics: json.schematics,
        packageJsonUpdates: json.packageJsonUpdates,
        ...json,
      };
    });

    generateFiles(
      tree,
      join(__dirname, './files/migration'),
      join(
        projectConfiguration.root,
        'src/migrations/update-16-0-0-add-nx-packages'
      ),
      {
        oldPackageName,
        newPackageName,
        migration: 'update-16-0-0-add-nx-packages',
      }
    );
  }
}

function needsRescope(tree: Tree, projectConfiguration: ProjectConfiguration) {
  try {
    const { name: packageName } = readJson(
      tree,
      join(projectConfiguration.root, 'package.json')
    );
    return (
      projectConfiguration.root.startsWith('packages/') &&
      packageName.startsWith('@nrwl') &&
      packageName !== '@nrwl/tao' &&
      packageName !== '@nrwl/cli'
    );
  } catch {
    return false;
  }
}

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  for (const [_, projectConfiguration] of projects) {
    if (needsRescope(tree, projectConfiguration)) {
      migratePackage(tree, projectConfiguration);
    }
  }

  console.log('Formatting files');
  await formatFiles(tree);
}
