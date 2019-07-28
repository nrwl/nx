import {
  chain,
  externalSchematic,
  noop,
  Rule,
  schematic,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';

import {
  insert,
  insertImport,
  updateWorkspaceInTree
} from '../../utils/ast-utils';

import { formatFiles } from '../../utils/rules/format-files';

import * as ts from 'typescript';
import { toFileName } from '@nrwl/workspace/src/utils/name-utils';

export default function(options: Schema): Rule {
  options = normalizeOptions(options);
  return (host: Tree, context: SchematicContext) => {
    return chain([createPreset(options), formatFiles()])(host, context);
  };
}

function createPreset(options: Schema): Rule {
  // const linter = options.cli === 'angular' ? 'tslint' : 'eslint';
  const linter = 'tslint';

  if (options.preset === 'empty') {
    return setDefaultLinter(linter);
  } else if (options.preset === 'angular') {
    return chain([
      externalSchematic(
        '@nrwl/angular',
        'application',
        {
          name: options.name,
          style: options.style
        },
        { interactive: false }
      ),
      setDefaultCollection('@nrwl/angular')
    ]);
  } else if (options.preset === 'react') {
    return chain([
      externalSchematic(
        '@nrwl/react',
        'application',
        {
          name: options.name,
          style: options.style,
          babel: true,
          linter
        },
        { interactive: false }
      ),
      setDefaultCollection('@nrwl/react'),
      setDefaultLinter(linter)
    ]);
  } else if (options.preset === 'web-components') {
    return chain([
      externalSchematic(
        '@nrwl/web',
        'application',
        {
          name: options.name,
          style: options.style,
          linter
        },
        { interactive: false }
      ),
      setDefaultCollection('@nrwl/web'),
      setDefaultLinter(linter)
    ]);
  } else if (options.preset === 'angular-nest') {
    return chain([
      externalSchematic(
        '@nrwl/angular',
        'application',
        { name: options.name, style: options.style },
        { interactive: false }
      ),
      externalSchematic(
        '@nrwl/nest',
        'application',
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
      setDefaultCollection('@nrwl/angular'),
      connectFrontendAndApi(options)
    ]);
  } else if (options.preset === 'react-express') {
    throw new Error(`Not implemented yet`);
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function connectFrontendAndApi(options: Schema) {
  const addImportToModule = require('@nrwl/angular/src/utils/ast-utils')
    .addImportToModule;
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

    const scope = options.npmScope;
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
    width="450"
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

function setDefaultCollection(defaultCollection: string) {
  return updateWorkspaceInTree(json => {
    if (!json.cli) {
      json.cli = {};
    }
    json.cli.defaultCollection = defaultCollection;
    return json;
  });
}

function setDefaultLinter(linter: string) {
  return updateWorkspaceInTree(json => {
    if (!json.schematics) {
      json.schematics = {};
    }
    json.schematics['@nrwl/workspace'] = { linter };
    json.schematics['@nrwl/cypress'] = { linter };
    json.schematics['@nrwl/react'] = { linter };
    json.schematics['@nrwl/web'] = { linter };
    json.schematics['@nrwl/node'] = { linter };
    return json;
  });
}

function normalizeOptions(options: Schema): Schema {
  options.name = toFileName(options.name);
  return options;
}
