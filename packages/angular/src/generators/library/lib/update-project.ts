import {
  generateFiles,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  getWorkspaceLayout,
  offsetFromRoot,
  joinPathFragments,
} from '@nrwl/devkit';
import { replaceAppNameWithPath } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from './normalized-schema';
import { updateNgPackage } from './update-ng-package';

export async function updateProject(host: Tree, options: NormalizedSchema) {
  createFiles(host, options);
  updateProjectTsConfig(host, options);
  fixProjectWorkspaceConfig(host, options);
  updateNgPackage(host, options);
  updateFiles(host, options);
}

function updateFiles(host: Tree, options: NormalizedSchema) {
  const libRoot = `${options.projectRoot}/src/lib/`;
  const serviceSpecPath = path.join(libRoot, `${options.name}.service.spec.ts`);
  const componentSpecPath = path.join(
    libRoot,
    `${options.name}.component.spec.ts`
  );

  host.delete(path.join(libRoot, `${options.name}.service.ts`));

  if (host.exists(serviceSpecPath)) {
    host.delete(serviceSpecPath);
  }

  host.delete(path.join(libRoot, `${options.name}.component.ts`));

  if (host.exists(componentSpecPath)) {
    host.delete(path.join(libRoot, `${options.name}.component.spec.ts`));
  }

  if (!options.publishable && !options.buildable) {
    host.delete(path.join(options.projectRoot, 'ng-package.json'));
    host.delete(path.join(options.projectRoot, 'package.json'));
    host.delete(path.join(options.projectRoot, 'tsconfig.lib.prod.json'));
  }

  host.delete(path.join(options.projectRoot, 'karma.conf.js'));
  host.delete(path.join(options.projectRoot, 'src/test.ts'));
  host.delete(path.join(options.projectRoot, 'tsconfig.spec.json'));

  if (options.name !== options.fileName) {
    host.delete(path.join(libRoot, `${options.name}.module.ts`));
  }
  if (!options.skipModule) {
    host.write(
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

    if (options.unitTestRunner !== 'none' && options.addModuleSpec) {
      host.write(
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
    options.skipModule
      ? ``
      : `
        export * from './lib/${options.fileName}.module';
        `
  );
}

function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    path.join(__dirname, '../files/lib'),
    options.projectRoot,
    {
      ...options,
      offsetFromRoot: offsetFromRoot(options.projectRoot),
      tpl: '',
    }
  );
}

function fixProjectWorkspaceConfig(host: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(host, options.name);
  project.tags = options.parsedTags;

  const fixedProject = replaceAppNameWithPath(
    project,
    options.name,
    options.projectRoot
  );

  if (!options.publishable && !options.buildable) {
    delete fixedProject.targets.build;
  } else {
    // Set the right builder for the type of library.
    // Ensure the outputs property comes after the builder for
    // better readability.
    const { executor, ...rest } = fixedProject.targets.build;
    fixedProject.targets.build = {
      executor: options.publishable
        ? '@nrwl/angular:package'
        : '@nrwl/angular:ng-packagr-lite',
      outputs: [
        joinPathFragments(
          'dist',
          getWorkspaceLayout(host).libsDir,
          options.projectDirectory
        ),
      ],
      ...rest,
    };
  }

  delete fixedProject.targets.test;

  updateProjectConfiguration(host, options.name, fixedProject);
}

function updateProjectTsConfig(host: Tree, options: NormalizedSchema) {
  if (!host.exists(`${options.projectRoot}/tsconfig.lib.json`)) {
    host.write(`${options.projectRoot}/tsconfig.lib.json`, '{}');
  }
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
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
        outDir: `${offsetFromRoot(options.projectRoot)}dist/out-tsc`,
      },
    };
  });
}
