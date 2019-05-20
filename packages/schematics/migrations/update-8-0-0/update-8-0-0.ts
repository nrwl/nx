import {
  Rule,
  chain,
  SchematicContext,
  Tree,
  externalSchematic,
  noop
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  readJsonInTree,
  addDepsToPackageJson,
  updateJsonInTree,
  insert,
  formatFiles
} from '@nrwl/workspace';
import {
  createSourceFile,
  ScriptTarget,
  isImportDeclaration,
  isStringLiteral
} from 'typescript';
import {
  getSourceNodes,
  ReplaceChange
} from '@nrwl/workspace/src/utils/ast-utils';

function addDependencies() {
  return (host: Tree) => {
    const dependencies = readJsonInTree(host, 'package.json').dependencies;
    const builders = new Set<string>();
    const projects = readJsonInTree(host, 'angular.json').projects;
    Object.values<any>(projects).forEach(project => {
      Object.values<any>(project.architect).forEach(target => {
        const [builderDependency] = target.builder.split(':');
        builders.add(builderDependency);
      });
    });
    const newDependencies = {};
    const newDevDependencies = {
      '@nrwl/workspace': '8.0.0'
    };
    if (dependencies['@angular/core']) {
      newDependencies['@nrwl/angular'] = '8.0.0';
    }
    if (dependencies['react']) {
      newDevDependencies['@nrwl/react'] = '8.0.0';
    }
    if (dependencies['@nestjs/core']) {
      newDevDependencies['@nrwl/nest'] = '8.0.0';
    }
    if (dependencies.express) {
      newDevDependencies['@nrwl/express'] = '8.0.0';
      newDevDependencies['@nrwl/node'] = '8.0.0';
    }
    if (builders.has('@nrwl/web')) {
      newDevDependencies['@nrwl/web'] = '8.0.0';
    }
    if (builders.has('@nrwl/node')) {
      newDevDependencies['@nrwl/node'] = '8.0.0';
    }
    if (builders.has('@nrwl/jest')) {
      newDevDependencies['@nrwl/jest'] = '8.0.0';
    }
    if (builders.has('@nrwl/cypress')) {
      newDevDependencies['@nrwl/cypress'] = '8.0.0';
    }
    return chain([addDepsToPackageJson(newDependencies, newDevDependencies)]);
  };
}

const removeOldDependencies = updateJsonInTree('package.json', json => {
  json.dependencies = json.dependencies || {};
  json.devDependencies = json.devDependencies || {};
  delete json.dependencies['@nrwl/nx'];
  delete json.devDependencies['@nrwl/nx'];
  delete json.dependencies['@nrwl/schematics'];
  delete json.devDependencies['@nrwl/schematics'];
  delete json.dependencies['@nrwl/builders'];
  delete json.devDependencies['@nrwl/builders'];

  return json;
});

const updateUpdateScript = updateJsonInTree('package.json', json => {
  json.scripts = json.scripts || {};
  json.scripts.update = 'ng update @nrwl/workspace';
  return json;
});

const updateBuilders = updateJsonInTree('angular.json', json => {
  Object.entries<any>(json.projects).forEach(([projectKey, project]) => {
    Object.entries<any>(project.architect).forEach(([targetKey, target]) => {
      if (target.builder === '@nrwl/builders:jest') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/jest:jest';
      }
      if (target.builder === '@nrwl/builders:cypress') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/cypress:cypress';
      }
      if (target.builder === '@nrwl/builders:web-build') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/web:build';
      }
      if (target.builder === '@nrwl/builders:web-dev-server') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/web:dev-server';
      }
      if (target.builder === '@nrwl/builders:node-build') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/node:build';
      }
      if (target.builder === '@nrwl/builders:node-execute') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/node:execute';
      }
      if (target.builder === '@nrwl/builders:run-commands') {
        json.projects[projectKey].architect[targetKey].builder =
          '@nrwl/workspace:run-commands';
      }
    });
  });
  return json;
});

const displayInformation = (host: Tree, context: SchematicContext) => {
  context.logger.info(stripIndents`
    Nx has been repackaged. We are installing and migrating your dependencies to the ones necessary.

    If you have workspace schematics, we tried to migrate your imports from "@nrwl/schematics" to "@nrwl/workspace" but your externalSchematics may be broken.
  `);
};

const updateNxModuleImports = (host: Tree) => {
  host.visit(path => {
    if (!path.endsWith('.ts')) {
      return;
    }

    const sourceFile = createSourceFile(
      path,
      host.read(path).toString(),
      ScriptTarget.Latest,
      true
    );
    const changes = [];
    sourceFile.statements.forEach(statement => {
      if (
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      ) {
        const nodeText = statement.moduleSpecifier.getText(sourceFile);
        const modulePath = statement.moduleSpecifier
          .getText(sourceFile)
          .substr(1, nodeText.length - 2);
        if (modulePath === '@nrwl/nx') {
          changes.push(
            new ReplaceChange(
              path,
              statement.moduleSpecifier.getStart(sourceFile),
              nodeText,
              `'@nrwl/angular'`
            )
          );
        }

        if (modulePath === '@nrwl/nx/testing') {
          changes.push(
            new ReplaceChange(
              path,
              statement.moduleSpecifier.getStart(sourceFile),
              nodeText,
              `'@nrwl/angular/testing'`
            )
          );
        }

        if (modulePath.startsWith('@nrwl/schematics')) {
          changes.push(
            new ReplaceChange(
              path,
              statement.moduleSpecifier.getStart(sourceFile),
              nodeText,
              nodeText.replace('@nrwl/schematics', '@nrwl/workspace')
            )
          );
        }
      }
    });
    insert(host, path, changes);
  });
};

const updateJestPlugin = (host: Tree) => {
  if (!host.exists('jest.config.js')) {
    return host;
  }

  const sourceFile = createSourceFile(
    'jest.config.js',
    host.read('jest.config.js').toString(),
    ScriptTarget.Latest,
    true
  );
  const changes = [];

  getSourceNodes(sourceFile).forEach(node => {
    if (isStringLiteral(node)) {
      const value = node
        .getText(sourceFile)
        .substr(1, node.getText(sourceFile).length - 2);
      if (value === '@nrwl/builders/plugins/jest/resolver') {
        changes.push(
          new ReplaceChange(
            'jest.config.js',
            node.getStart(sourceFile),
            node.getText(sourceFile),
            `'@nrwl/jest/plugins/resolver'`
          )
        );
      }
    }
  });
  insert(host, 'jest.config.js', changes);
};

const updateTslintRules = updateJsonInTree('tslint.json', json => {
  const { rulesDirectory } = json;
  json.rulesDirectory = rulesDirectory.map(directory => {
    return directory === 'node_modules/@nrwl/schematics/src/tslint'
      ? 'node_modules/@nrwl/workspace/src/tslint'
      : directory;
  });
  return json;
});

const updateDefaultCollection = (host: Tree) => {
  const { dependencies, devDependencies } = readJsonInTree(
    host,
    'package.json'
  );

  return updateJsonInTree('angular.json', json => {
    json.cli = json.cli || {};
    if (dependencies['@nrwl/angular']) {
      json.cli.defaultCollection = '@nrwl/angular';
    } else if (devDependencies['@nrwl/react']) {
      json.cli.defaultCollection = '@nrwl/react';
    } else if (devDependencies['@nrwl/nest']) {
      json.cli.defaultCollection = '@nrwl/nest';
    } else if (devDependencies['@nrwl/express']) {
      json.cli.defaultCollection = '@nrwl/express';
    } else if (devDependencies['@nrwl/web']) {
      json.cli.defaultCollection = '@nrwl/web';
    } else if (devDependencies['@nrwl/node']) {
      json.cli.defaultCollection = '@nrwl/node';
    } else {
      json.cli.defaultCollection = '@nrwl/workspace';
    }
    return json;
  });
};

const setRootDirAndUpdateOurDir = (host: Tree) => {
  host.visit(path => {
    if (!path.endsWith('.json')) {
      return;
    }

    const json = host.read(path).toString();
    const match = json.match(/"outDir"\s*:\s*"([^"]+)"/);
    if (match) {
      const outParts = match[1].split('out-tsc');
      if (outParts.length > 1) {
        const updatedJson = json.replace(
          /"outDir"\s*:\s*"([^"]+)"/,
          `"outDir": "${outParts[0]}out-tsc"`
        );
        host.overwrite(path, updatedJson);
      }
    }
  });

  updateJsonInTree('tsconfig.json', json => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.rootDir = '.';
    return json;
  })(host, null);
};

export const runAngularMigrations: Rule = (
  host: Tree,
  context: SchematicContext
) => {
  const packageJson = readJsonInTree(host, 'package.json');

  return !!packageJson.dependencies['@angular/core']
    ? chain([
        externalSchematic(
          '@schematics/update',
          'update',
          {
            packages: ['@angular/cli'],
            from: '7.2.2',
            to: '8.0.0-rc.3',
            force: true,
            next: true
          },
          {
            interactive: true
          }
        ),
        externalSchematic(
          '@schematics/update',
          'update',
          {
            packages: ['@angular/core'],
            from: '7.0.0',
            to: '8.0.0-rc.3',
            force: true,
            next: true
          },
          {
            interactive: true
          }
        )
      ])
    : noop();
};

export default function(): Rule {
  return chain([
    displayInformation,
    runAngularMigrations,
    removeOldDependencies,
    updateUpdateScript,
    updateBuilders,
    updateJestPlugin,
    updateNxModuleImports,
    updateTslintRules,
    addDependencies(),
    updateDefaultCollection,
    setRootDirAndUpdateOurDir,
    formatFiles()
  ]);
}
