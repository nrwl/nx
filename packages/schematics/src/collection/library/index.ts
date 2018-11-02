import {
  chain,
  externalSchematic,
  noop,
  Rule,
  Tree,
  SchematicContext,
  schematic
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import { insertImport } from '@schematics/angular/utility/ast-utils';
import * as ts from 'typescript';
import {
  addGlobal,
  addImportToModule,
  addIncludeToTsConfig,
  addRoute,
  insert,
  updateJsonInTree
} from '../../utils/ast-utils';
import { offsetFromRoot } from '../../utils/common';
import {
  toClassName,
  toFileName,
  toPropertyName
} from '../../utils/name-utils';
import {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath
} from '@nrwl/schematics/src/utils/cli-config-utils';
import { formatFiles } from '../../utils/rules/format-files';
import { updateKarmaConf } from '../../utils/rules/update-karma-conf';
import { join, normalize } from '@angular-devkit/core';
import { move } from '../../utils/rules/move';

interface NormalizedSchema extends Schema {
  name: string;
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
    const constName = `${toPropertyName(options.name)}Routes`;

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
        `{path: '${toFileName(options.name)}', loadChildren: '${loadChildren}'}`
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
    const constName = `${toPropertyName(options.name)}Routes`;
    const importPath = `@${npmScope}/${options.projectDirectory}`;

    insert(host, options.parentModule, [
      insertImport(sourceFile, options.parentModule, constName, importPath),
      ...addRoute(
        options.parentModule,
        sourceFile,
        `{path: '${toFileName(options.name)}', children: ${constName}}`
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
  return (host: Tree) => {
    const libRoot = `${options.projectRoot}/src/lib/`;

    host.delete(path.join(libRoot, `${options.name}.service.ts`));
    host.delete(path.join(libRoot, `${options.name}.service.spec.ts`));
    host.delete(path.join(libRoot, `${options.name}.component.ts`));
    host.delete(path.join(libRoot, `${options.name}.component.spec.ts`));

    if (!options.publishable) {
      host.delete(path.join(options.projectRoot, 'ng-package.json'));
      host.delete(path.join(options.projectRoot, 'package.json'));
    }

    if (options.unitTestRunner !== 'karma') {
      host.delete(path.join(options.projectRoot, 'karma.conf.js'));
      host.delete(path.join(options.projectRoot, 'src/test.ts'));
      host.delete(path.join(options.projectRoot, 'tsconfig.spec.json'));
    }

    if (options.module) {
      host.overwrite(
        path.join(libRoot, `${options.name}.module.ts`),
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
          path.join(libRoot, `${options.name}.module.spec.ts`),
          `
    import { async, TestBed } from '@angular/core/testing';
    import { ${options.moduleName} } from './${options.name}.module';
    
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
        export * from './lib/${options.name}.module';
        `
      );
    } else {
      host.delete(path.join(libRoot, `${options.name}.module.ts`));
      host.create(path.join(libRoot, `.gitkeep`), '');
      host.overwrite(`${options.projectRoot}/src/index.ts`, '');
    }

    return chain([
      updateJsonInTree(getWorkspacePath(host), json => {
        const project = json.projects[options.name];
        const fixedProject = replaceAppNameWithPath(
          project,
          options.name,
          options.projectRoot
        );

        if (!options.publishable) {
          delete fixedProject.architect.build;
        }

        if (options.unitTestRunner !== 'karma') {
          delete fixedProject.architect.test;

          fixedProject.architect.lint.options.tsConfig = fixedProject.architect.lint.options.tsConfig.filter(
            path =>
              path !==
              join(normalize(options.projectRoot), 'tsconfig.spec.json')
          );
        }

        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.projectRoot}/tsconfig.lib.json`, json => {
        json.exclude = json.exclude || [];
        return {
          ...json,
          extends: `${offsetFromRoot(options.projectRoot)}tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc/${
              options.projectRoot
            }`
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
      updateNgPackage(options),
      options.unitTestRunner === 'karma' ? updateKarmaConfig(options) : noop()
    ])(host, null);
  };
}

function updateKarmaConfig(options: NormalizedSchema) {
  return chain([
    host => {
      const karma = host
        .read(`${options.projectRoot}/karma.conf.js`)
        .toString();
      host.overwrite(
        `${options.projectRoot}/karma.conf.js`,
        karma.replace(
          `'../../coverage${options.projectRoot}'`,
          `'${offsetFromRoot(options.projectRoot)}coverage'`
        )
      );
    },
    updateJsonInTree(`${options.projectRoot}/tsconfig.spec.json`, json => {
      return {
        ...json,
        extends: `${offsetFromRoot(options.projectRoot)}tsconfig.json`,
        compilerOptions: {
          ...json.compilerOptions,
          outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc/${
            options.projectRoot
          }`
        }
      };
    }),
    updateKarmaConf({
      projectName: options.name
    })
  ]);
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      const nxJson = JSON.parse(host.read('nx.json').toString());
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
  return updateJsonInTree(`${options.projectRoot}/package.json`, json => {
    json.name = `@${options.prefix}/${options.name}`;
    return json;
  });
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
      externalSchematic('@schematics/angular', 'library', {
        name: options.name,
        prefix: options.prefix,
        entryFile: 'index',
        skipPackageJson: !options.publishable,
        skipTsConfig: true
      }),

      move(options.name, options.projectRoot),
      updateProject(options),
      updateTsConfig(options),
      options.unitTestRunner === 'jest'
        ? schematic('jest-project', {
            project: options.name,
            skipSetupFile: !options.module
          })
        : noop(),

      options.publishable ? updateLibPackageNpmScope(options) : noop(),
      options.module ? addModule(options) : noop(),
      formatFiles(options)
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `libs/${projectDirectory}`;
  const moduleName = `${toClassName(projectName)}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${projectName}.module.ts`;
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
    parsedTags
  };
}
