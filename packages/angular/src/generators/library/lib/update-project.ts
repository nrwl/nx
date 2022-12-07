import {
  addProjectConfiguration,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  removeProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { replaceAppNameWithPath } from '@nrwl/workspace/src/utils/cli-config-utils';
import { NormalizedSchema } from './normalized-schema';
import { updateNgPackage } from './update-ng-package';
import { join } from 'path';

export async function updateProject(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  createFiles(host, options);
  updateProjectTsConfig(host, options);
  fixProjectWorkspaceConfig(host, options);
  updateNgPackage(host, options);
  updateFiles(host, options);
}

function updateFiles(host: Tree, options: NormalizedSchema['libraryOptions']) {
  const libRoot = `${options.projectRoot}/src/lib/`;
  const serviceSpecPath = joinPathFragments(
    libRoot,
    `${options.name}.service.spec.ts`
  );
  const componentSpecPath = joinPathFragments(
    libRoot,
    `${options.name}.component.spec.ts`
  );

  host.delete(joinPathFragments(libRoot, `${options.name}.service.ts`));

  if (host.exists(serviceSpecPath)) {
    host.delete(serviceSpecPath);
  }

  host.delete(joinPathFragments(libRoot, `${options.name}.component.ts`));

  if (host.exists(componentSpecPath)) {
    host.delete(
      joinPathFragments(libRoot, `${options.name}.component.spec.ts`)
    );
  }

  if (!options.publishable && !options.buildable) {
    host.delete(joinPathFragments(options.projectRoot, 'ng-package.json'));
    host.delete(joinPathFragments(options.projectRoot, 'package.json'));
    host.delete(
      joinPathFragments(options.projectRoot, 'tsconfig.lib.prod.json')
    );
    host.delete(joinPathFragments(options.projectRoot, '.browserslistrc'));
  }

  host.delete(joinPathFragments(options.projectRoot, 'karma.conf.js'));
  host.delete(joinPathFragments(options.projectRoot, 'src/test.ts'));
  host.delete(joinPathFragments(options.projectRoot, 'tsconfig.spec.json'));

  if (options.name !== options.fileName) {
    host.delete(joinPathFragments(libRoot, `${options.name}.module.ts`));
  }
  if (!options.skipModule && !options.standalone) {
    host.write(
      joinPathFragments(libRoot, `${options.fileName}.module.ts`),
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

    if (options.unitTestRunner !== 'none' && options.addModuleSpec) {
      host.write(
        joinPathFragments(libRoot, `${options.fileName}.module.spec.ts`),
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
    
      // TODO: Add real tests here.
      //
      // NB: This particular test does not do anything useful. 
      //     It does NOT check for correct instantiation of the module.
      it('should have a module definition', () => {
        expect(${options.moduleName}).toBeDefined();
      });
    });
          `
      );
    }
  } else {
    host.delete(joinPathFragments(libRoot, `${options.fileName}.module.ts`));
  }

  host.write(
    `${options.projectRoot}/src/index.ts`,
    options.skipModule || options.standalone
      ? ``
      : `
        export * from './lib/${options.fileName}.module';
        `
  );
}

function createFiles(host: Tree, options: NormalizedSchema['libraryOptions']) {
  generateFiles(host, join(__dirname, '../files/lib'), options.projectRoot, {
    ...options,
    rootTsConfigPath: getRelativePathToRootTsConfig(host, options.projectRoot),
    tpl: '',
  });
}

function fixProjectWorkspaceConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  let project = readProjectConfiguration(host, options.name);
  project.tags = options.parsedTags;

  if (options.ngCliSchematicLibRoot !== options.projectRoot) {
    project = replaceAppNameWithPath(
      project,
      options.ngCliSchematicLibRoot,
      options.projectRoot
    );
    // project already has the right root, but the above function, makes it incorrect.
    // This corrects it.
    project.root = options.projectRoot;
  }

  if (!options.publishable && !options.buildable) {
    delete project.targets.build;
  } else {
    // Set the right builder for the type of library.
    // Ensure the outputs property comes after the builder for
    // better readability.
    const { executor, ...rest } = project.targets.build;
    project.targets.build = {
      executor: options.publishable
        ? '@nrwl/angular:package'
        : '@nrwl/angular:ng-packagr-lite',
      outputs: ['{workspaceRoot}/dist/{projectRoot}'],
      ...rest,
    };
  }

  delete project.targets.test;

  /**
   * The "$schema" property on our configuration files is only added when the
   * project configuration is added and not when updating it. It's done this
   * way to avoid re-adding "$schema" when updating a project configuration
   * and that property was intentionally removed by the devs.
   *
   * Since the project gets created by the Angular application schematic,
   * the "$schema" property is not added, so we remove the project and add
   * it back to workaround that.
   */
  removeProjectConfiguration(host, options.name);
  addProjectConfiguration(
    host,
    options.name,
    project,
    options.standaloneConfig
  );
}

function updateProjectTsConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (!host.exists(`${options.projectRoot}/tsconfig.lib.json`)) {
    host.write(`${options.projectRoot}/tsconfig.lib.json`, '{}');
  }
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
    if (options.unitTestRunner === 'jest') {
      json.exclude = ['src/test-setup.ts', 'src/**/*.spec.ts'];
    } else if (options.unitTestRunner === 'none') {
      json.exclude = [];
    } else {
      json.exclude = json.exclude || [];
      json.exclude = json.exclude.map((v) => {
        if (v.startsWith('**/*')) {
          return v.replace('**/*', 'src/**/*');
        }
        return v;
      });
    }

    return {
      ...json,
      extends: `./tsconfig.json`,
      compilerOptions: {
        ...json.compilerOptions,
        outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc`,
      },
    };
  });
}
