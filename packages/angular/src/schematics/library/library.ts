import { join, normalize } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  MergeStrategy,
  mergeWith,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import * as ts from 'typescript';

import {
  addGlobal,
  addIncludeToTsConfig,
  addLintFiles,
  formatFiles,
  getNpmScope,
  getWorkspacePath,
  insert,
  Linter,
  NxJson,
  offsetFromRoot,
  readJsonInTree,
  replaceAppNameWithPath,
  toClassName,
  toFileName,
  toPropertyName,
  updateJsonInTree
} from '@nrwl/workspace';
import { addUnitTestRunner } from '../init/init';
import { addImportToModule, addRoute } from '../../utils/ast-utils';
import { insertImport } from '@nrwl/workspace/src/utils/ast-utils';

interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  entryFile: string;
  modulePath: string;
  moduleName: string;
  projectDirectory: string;
  parsedTags: string[];
}

function addLazyLoadedRouterConfiguration(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const moduleSource = host.read(options.modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      options.modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, options.modulePath, [
      insertImport(
        sourceFile,
        options.modulePath,
        'RouterModule',
        '@angular/router'
      ),
      ...addImportToModule(
        sourceFile,
        options.modulePath,
        `
        RouterModule.forChild([
        /* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */
       ]) `
      )
    ]);
    return host;
  };
}

function addRouterConfiguration(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const moduleSource = host.read(options.modulePath)!.toString('utf-8');
    const moduleSourceFile = ts.createSourceFile(
      options.modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    const constName = `${toPropertyName(options.fileName)}Routes`;

    insert(host, options.modulePath, [
      insertImport(
        moduleSourceFile,
        options.modulePath,
        'RouterModule, Route',
        '@angular/router'
      ),
      ...addImportToModule(
        moduleSourceFile,
        options.modulePath,
        `RouterModule`
      ),
      ...addGlobal(
        moduleSourceFile,
        options.modulePath,
        `export const ${constName}: Route[] = [];`
      )
    ]);
    return host;
  };
}

function addLoadChildren(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const npmScope = getNpmScope(host);

    if (!host.exists(options.parentModule)) {
      throw new Error(`Cannot find '${options.parentModule}'`);
    }

    const moduleSource = host.read(options.parentModule)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      options.parentModule,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );

    insert(host, options.parentModule, [
      ...addRoute(
        options.parentModule,
        sourceFile,
        `{path: '${toFileName(
          options.fileName
        )}', loadChildren: () => import('@${npmScope}/${
          options.projectDirectory
        }').then(module => module.${options.moduleName})}`
      )
    ]);

    const tsConfig = findClosestTsConfigApp(host, options.parentModule);
    if (tsConfig) {
      const tsConfigAppSource = host.read(tsConfig)!.toString('utf-8');
      const tsConfigAppFile = ts.createSourceFile(
        tsConfig,
        tsConfigAppSource,
        ts.ScriptTarget.Latest,
        true
      );

      const offset = offsetFromRoot(path.dirname(tsConfig));
      insert(host, tsConfig, [
        ...addIncludeToTsConfig(
          tsConfig,
          tsConfigAppFile,
          `\n    , "${offset}${options.projectRoot}/src/index.ts"\n`
        )
      ]);
    } else {
      // we should warn the user about not finding the config
    }

    return host;
  };
}

function findClosestTsConfigApp(
  host: Tree,
  parentModule: string
): string | null {
  const dir = path.parse(parentModule).dir;
  if (host.exists(`${dir}/tsconfig.app.json`)) {
    return `${dir}/tsconfig.app.json`;
  } else if (dir != '') {
    return findClosestTsConfigApp(host, dir);
  } else {
    return null;
  }
}

function addChildren(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const npmScope = getNpmScope(host);
    if (!host.exists(options.parentModule)) {
      throw new Error(`Cannot find '${options.parentModule}'`);
    }
    const moduleSource = host.read(options.parentModule)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      options.parentModule,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    const constName = `${toPropertyName(options.fileName)}Routes`;
    const importPath = `@${npmScope}/${options.projectDirectory}`;

    insert(host, options.parentModule, [
      insertImport(
        sourceFile,
        options.parentModule,
        `${options.moduleName}, ${constName}`,
        importPath
      ),
      ...addImportToModule(
        sourceFile,
        options.parentModule,
        options.moduleName
      ),
      ...addRoute(
        options.parentModule,
        sourceFile,
        `{path: '${toFileName(options.fileName)}', children: ${constName}}`
      )
    ]);
    return host;
  };
}

function updateNgPackage(options: NormalizedSchema): Rule {
  if (!options.publishable) {
    return noop();
  }
  const dest = `${offsetFromRoot(options.projectRoot)}dist/libs/${
    options.projectDirectory
  }`;
  return chain([
    updateJsonInTree(`${options.projectRoot}/ng-package.json`, json => {
      let $schema = json.$schema;
      if (json.$schema && json.$schema.indexOf('node_modules') >= 0) {
        $schema = `${offsetFromRoot(
          options.projectRoot
        )}${json.$schema.substring(
          json.$schema.indexOf('node_modules'),
          json.$schema.length
        )}`;
      }
      return {
        ...json,
        dest,
        $schema
      };
    })
  ]);
}

function updateProject(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const libRoot = `${options.projectRoot}/src/lib/`;

    host.delete(path.join(libRoot, `${options.name}.service.ts`));
    host.delete(path.join(libRoot, `${options.name}.service.spec.ts`));
    host.delete(path.join(libRoot, `${options.name}.component.ts`));
    host.delete(path.join(libRoot, `${options.name}.component.spec.ts`));

    if (!options.publishable) {
      host.delete(path.join(options.projectRoot, 'ng-package.json'));
      host.delete(path.join(options.projectRoot, 'package.json'));
    }

    host.delete(path.join(options.projectRoot, 'karma.conf.js'));
    host.delete(path.join(options.projectRoot, 'src/test.ts'));
    host.delete(path.join(options.projectRoot, 'tsconfig.spec.json'));

    host.delete(path.join(libRoot, `${options.name}.module.ts`));
    host.create(
      path.join(libRoot, `${options.fileName}.module.ts`),
      `
        import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        
        @NgModule({
          imports: [
            CommonModule
          ]
        })
        export class ${options.moduleName} { }
        `
    );

    if (options.unitTestRunner !== 'none') {
      host.create(
        path.join(libRoot, `${options.fileName}.module.spec.ts`),
        `
    import { async, TestBed } from '@angular/core/testing';
    import { ${options.moduleName} } from './${options.fileName}.module';
    
    describe('${options.moduleName}', () => {
      beforeEach(async(() => {
        TestBed.configureTestingModule({
          imports: [ ${options.moduleName} ]
        })
        .compileComponents();
      }));
    
      it('should create', () => {
        expect(${options.moduleName}).toBeDefined();
      });
    });
          `
      );
    }
    host.overwrite(
      `${options.projectRoot}/src/index.ts`,
      `
        export * from './lib/${options.fileName}.module';
        `
    );

    return chain([
      mergeWith(
        apply(url('./files/lib'), [
          template({
            ...options,
            offsetFromRoot: offsetFromRoot(options.projectRoot)
          }),
          move(options.projectRoot)
        ]),
        MergeStrategy.Overwrite
      ),
      updateJsonInTree(getWorkspacePath(host), json => {
        const project = json.projects[options.name];
        const fixedProject = replaceAppNameWithPath(
          project,
          options.name,
          options.projectRoot
        );

        fixedProject.schematics = fixedProject.schematics || {};
        if (options.style !== 'css') {
          fixedProject.schematics = {
            ...fixedProject.schematics,
            '@nrwl/angular:component': {
              styleext: options.style
            }
          };
        }

        if (!options.publishable) {
          delete fixedProject.architect.build;
        }

        delete fixedProject.architect.test;

        fixedProject.architect.lint.options.tsConfig = fixedProject.architect.lint.options.tsConfig.filter(
          path =>
            path !== join(normalize(options.projectRoot), 'tsconfig.spec.json')
        );
        fixedProject.architect.lint.options.exclude.push(
          '!' + join(normalize(options.projectRoot), '**')
        );

        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.projectRoot}/tsconfig.lib.json`, json => {
        if (options.unitTestRunner === 'jest') {
          json.exclude = ['src/test-setup.ts', '**/*.spec.ts'];
        } else if (options.unitTestRunner === 'none') {
          json.exclude = [];
        } else {
          json.exclude = json.exclude || [];
        }

        return {
          ...json,
          extends: `./tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc`
          }
        };
      }),
      updateJsonInTree(`${options.projectRoot}/tslint.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.projectRoot)}tslint.json`
        };
      }),
      updateJsonInTree(`/nx.json`, json => {
        return {
          ...json,
          projects: {
            ...json.projects,
            [options.name]: { tags: options.parsedTags }
          }
        };
      }),
      updateNgPackage(options)
    ])(host, context);
  };
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
      return updateJsonInTree('tsconfig.json', json => {
        const c = json.compilerOptions;
        delete c.paths[options.name];
        c.paths[`@${nxJson.npmScope}/${options.projectDirectory}`] = [
          `libs/${options.projectDirectory}/src/index.ts`
        ];
        return json;
      })(host, context);
    }
  ]);
}

function updateLibPackageNpmScope(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return updateJsonInTree(`${options.projectRoot}/package.json`, json => {
      json.name = `@${getNpmScope(host)}/${options.name}`;
      return json;
    });
  };
}

function addModule(options: NormalizedSchema): Rule {
  return chain([
    options.routing && options.lazy
      ? addLazyLoadedRouterConfiguration(options)
      : noop(),
    options.routing && options.lazy && options.parentModule
      ? addLoadChildren(options)
      : noop(),
    options.routing && !options.lazy ? addRouterConfiguration(options) : noop(),
    options.routing && !options.lazy && options.parentModule
      ? addChildren(options)
      : noop()
  ]);
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    if (!options.routing && options.lazy) {
      throw new Error(`routing must be set`);
    }

    return chain([
      addLintFiles(options.projectRoot, Linter.TsLint, { onlyGlobal: true }),
      addUnitTestRunner(options),
      externalSchematic('@schematics/angular', 'library', {
        name: options.name,
        prefix: options.prefix,
        style: options.style,
        entryFile: 'index',
        skipPackageJson: !options.publishable,
        skipTsConfig: true
      }),

      move(options.name, options.projectRoot),
      updateProject(options),
      updateTsConfig(options),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'angular',
            supportTsx: false,
            skipSerializers: false
          })
        : noop(),
      options.unitTestRunner === 'karma'
        ? schematic('karma-project', {
            project: options.name
          })
        : noop(),
      options.publishable ? updateLibPackageNpmScope(options) : noop(),
      addModule(options),
      formatFiles(options)
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = `libs/${projectDirectory}`;

  const moduleName = `${toClassName(fileName)}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${fileName}.module.ts`;
  const defaultPrefix = getNpmScope(host);

  return {
    ...options,
    prefix: options.prefix ? options.prefix : defaultPrefix,
    name: projectName,
    projectRoot,
    entryFile: 'index',
    moduleName,
    projectDirectory,
    modulePath,
    parsedTags,
    fileName
  };
}
