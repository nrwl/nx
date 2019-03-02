import {
  chain,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import {
  addImportToModule,
  insert,
  updateJsonInTree
} from '../../utils/ast-utils';
import * as ts from 'typescript';
import { insertImport } from '@schematics/angular/utility/ast-utils';
import {
  NodePackageInstallTask,
  RepositoryInitializerTask
} from '@angular-devkit/schematics/tasks';
import { Framework } from '../../utils/frameworks';

export default function(options: Schema): Rule {
  if (!options.directory) {
    options.directory = options.name;
  }

  const workspaceOpts = { ...options, preset: undefined };
  return (host: Tree, context: SchematicContext) => {
    return chain([
      schematic('workspace', workspaceOpts),
      createPreset(options),
      move('/', options.directory),
      addTasks(options)
    ])(Tree.empty(), context);
  };
}

function createPreset(options: Schema): Rule {
  if (options.preset === 'empty') {
    return noop();
  } else if (options.preset === 'angular') {
    return chain([
      schematic(
        'application',
        {
          name: options.name,
          style: options.style,
          framework: Framework.Angular
        },
        { interactive: false }
      ),
      setDefaultAppFramework(Framework.Angular)
    ]);
  } else if (options.preset === 'react') {
    return chain([
      schematic(
        'application',
        {
          name: options.name,
          style: options.style,
          framework: Framework.React
        },
        { interactive: false }
      ),
      setDefaultAppFramework(Framework.React)
    ]);
  } else if (options.preset === 'web-components') {
    return chain([
      schematic(
        'application',
        {
          name: options.name,
          style: options.style,
          framework: Framework.WebComponents
        },
        { interactive: false }
      ),
      setDefaultAppFramework(Framework.WebComponents)
    ]);
  } else {
    return chain([
      schematic(
        'application',
        { name: options.name, style: options.style },
        { interactive: false }
      ),
      schematic(
        'node-application',
        {
          name: 'api',
          frontendProject: options.name
        },
        { interactive: false }
      ),
      schematic(
        'library',
        { name: 'api-interface', framework: 'none' },
        { interactive: false }
      ),
      setDefaultAppFramework(Framework.Angular),
      connectFrontendAndApi(options)
    ]);
  }
}

function connectFrontendAndApi(options: Schema) {
  return (host: Tree) => {
    host.create(
      'libs/api-interface/src/lib/interfaces.ts',
      `export interface Message { message: string }`
    );
    host.overwrite(
      'libs/api-interface/src/index.ts',
      `export * from './lib/interfaces';`
    );

    const modulePath = `apps/${options.name}/src/app/app.module.ts`;
    const moduleFile = ts.createSourceFile(
      modulePath,
      host.read(modulePath).toString(),
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, modulePath, [
      insertImport(
        moduleFile,
        modulePath,
        'HttpClientModule',
        `@angular/common/http`
      ),
      ...addImportToModule(
        moduleFile,
        `@angular/common/http`,
        `HttpClientModule`
      )
    ]);

    const scope = options.npmScope ? options.npmScope : options.name;
    const style = options.style ? options.style : 'css';
    host.overwrite(
      `apps/${options.name}/src/app/app.component.ts`,
      `import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Message } from '@${scope}/api-interface';

@Component({
  selector: '${scope}-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.${style}']
})
export class AppComponent {
  hello$ = this.http.get<Message>('/api/hello')
  constructor(private http: HttpClient) {}
}    
    `
    );

    host.overwrite(
      `apps/${options.name}/src/app/app.component.spec.ts`,
      `import { Component } from '@angular/core';
import { TestBed, async } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [HttpClientModule]
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });
});    
    `
    );

    host.overwrite(
      `apps/${options.name}/src/app/app.component.html`,
      `<div style="text-align:center">
  <h1>Welcome to ${options.name}!</h1>
  <img
    width="300"
    src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png"
  />
</div>
<div>Message: {{ (hello$|async)|json }}</div>
    `
    );

    host.overwrite(
      `apps/api/src/app/app.controller.ts`,
      `import { Controller, Get } from '@nestjs/common';

import { Message } from '@${scope}/api-interface';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  getData(): Message {
    return this.appService.getData();
  }
}
    `
    );

    host.overwrite(
      `apps/api/src/app/app.service.ts`,
      `import { Injectable } from '@nestjs/common';
import { Message } from '@${scope}/api-interface';

@Injectable()
export class AppService {
  getData(): Message {
    return { message: 'Welcome to api!' };
  }
}
    `
    );
  };
}

function addTasks(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    let packageTask;
    if (!options.skipInstall) {
      packageTask = context.addTask(
        new NodePackageInstallTask(options.directory)
      );
    }
    if (!options.skipGit) {
      const commit =
        typeof options.commit == 'object'
          ? options.commit
          : !!options.commit
          ? {}
          : false;
      context.addTask(
        new RepositoryInitializerTask(options.directory, commit),
        packageTask ? [packageTask] : []
      );
    }
  };
}

function setDefaultAppFramework(framework: Framework) {
  return updateJsonInTree('angular.json', json => {
    if (!json.schematics) {
      json.schematics = {};
    }
    if (!json.schematics['@nrwl/schematics:application']) {
      json.schematics['@nrwl/schematics:application'] = {};
    }
    if (!json.schematics['@nrwl/schematics:application'].framework) {
      json.schematics['@nrwl/schematics:application'].framework = framework;
    }
    return json;
  });
}
