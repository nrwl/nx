import { join, normalize } from '@angular-devkit/core';
import {
  chain,
  externalSchematic,
  noop,
  Rule,
  Tree,
  SchematicContext,
  schematic,
  url,
  apply,
  mergeWith,
  move,
  template
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import { insertImport } from '@schematics/angular/utility/ast-utils';
import * as ts from 'typescript';

import { NxJson } from '../../command-line/shared';
import {
  addGlobal,
  addImportToModule,
  addIncludeToTsConfig,
  addRoute,
  insert,
  updateJsonInTree,
  readJsonInTree
} from '../../utils/ast-utils';
import { offsetFromRoot } from '../../utils/common';
import {
  toClassName,
  toFileName,
  toPropertyName,
  names
} from '../../utils/name-utils';
import {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath
} from '../../utils/cli-config-utils';
import { formatFiles } from '../../utils/rules/format-files';
import { Framework } from '../../utils/frameworks';

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

    const loadChildren = `@${npmScope}/${options.projectDirectory}#${
      options.moduleName
    }`;

    insert(host, options.parentModule, [
      ...addRoute(
        options.parentModule,
        sourceFile,
        `{path: '${toFileName(
          options.fileName
        )}', loadChildren: '${loadChildren}'}`
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
      return {
        ...json,
        dest
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

    if (options.framework === Framework.Angular) {
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
    } else {
      host.delete(path.join(libRoot, `${options.fileName}.module.ts`));
      host.create(path.join(libRoot, `.gitkeep`), '');
      host.overwrite(`${options.projectRoot}/src/index.ts`, '');
    }

    return chain([
      mergeWith(
        apply(url('./files/lib'), [
          template({
            ...options,
            offsetFromRoot: offsetFromRoot(options.projectRoot)
          }),
          move(options.projectRoot)
        ])
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
            '@nrwl/schematics:component': {
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

        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.projectRoot}/tsconfig.lib.json`, json => {
        json.exclude = json.exclude || [];
        return {
          ...json,
          extends: `./tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc/${
              options.projectRoot
            }`
          },
          angularCompilerOptions:
            options.framework === Framework.Angular
              ? json.angularCompilerOptions
              : undefined
        };
      }),
      updateJsonInTree(`${options.projectRoot}/tslint.json`, json => {
        return {
          ...json,
          rules: options.framework === Framework.Angular ? json.rules : [],
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

function createAdditionalFiles(options: NormalizedSchema): Rule {
  switch (options.framework) {
    case Framework.React:
      return chain([
        mergeWith(
          apply(url(`./files/${options.framework}`), [
            template({
              ...options,
              tmpl: '',
              ...names(options.name)
            }),
            move(options.projectRoot)
          ])
        ),
        (host: Tree) => {
          host.overwrite(
            `${options.projectRoot}/src/index.ts`,
            ` export * from './lib/${options.fileName}';\n`
          );
        }
      ]);

    default:
      return noop();
  }
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
    const options = normalizeOptions(host, context, schema);
    if (!options.routing && options.lazy) {
      throw new Error(`routing must be set`);
    }

    return chain([
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
      createAdditionalFiles(options),
      options.unitTestRunner === 'jest'
        ? schematic('jest-project', {
            project: options.name,
            setupFile:
              options.framework === Framework.Angular ? 'angular' : 'none',
            supportTsx: options.framework === Framework.React,
            skipSerializers: options.framework !== Framework.Angular
          })
        : noop(),
      options.unitTestRunner === 'karma'
        ? schematic('karma-project', {
            project: options.name
          })
        : noop(),
      options.publishable ? updateLibPackageNpmScope(options) : noop(),
      options.framework === Framework.Angular ? addModule(options) : noop(),
      formatFiles(options)
    ])(host, context);
  };
}

function normalizeOptions(
  host: Tree,
  context: SchematicContext,
  options: Schema
): NormalizedSchema {
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

  if (!options.module) {
    context.logger.warn(
      'Deprecated: --module is deprecated in favor of --framework'
    );
    options.framework = Framework.None;
  }

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
