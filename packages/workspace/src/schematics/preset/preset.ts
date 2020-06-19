import {
  chain,
  externalSchematic,
  noop,
  Rule,
  schematic,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { Schema } from './schema';

import {
  addDepsToPackageJson,
  addGlobal,
  insert,
  insertImport,
  updateWorkspaceInTree,
} from '../../utils/ast-utils';

import { formatFiles } from '../../utils/rules/format-files';

import * as ts from 'typescript';
import { toFileName } from '../../utils/name-utils';

export default function (options: Schema): Rule {
  options = normalizeOptions(options);
  return (host: Tree, context: SchematicContext) => {
    return chain([createPreset(options), formatFiles()])(host, context);
  };
}

function createPreset(options: Schema): Rule {
  const linter = options.cli === 'angular' ? 'tslint' : 'eslint';

  if (options.preset === 'empty') {
    return noop();
  } else if (options.preset === 'oss') {
    return noop();
  } else if (options.preset === 'angular') {
    return chain([
      externalSchematic('@nrwl/angular', 'application', {
        name: options.name,
        style: options.style,
      }),
      setDefaultCollection('@nrwl/angular'),
    ]);
  } else if (options.preset === 'react') {
    return chain([
      externalSchematic('@nrwl/react', 'application', {
        name: options.name,
        style: options.style,
        linter,
      }),
      setDefaultCollection('@nrwl/react'),
    ]);
  } else if (options.preset === 'next') {
    return chain([
      externalSchematic('@nrwl/next', 'application', {
        name: options.name,
        style: options.style,
        linter,
      }),
      setDefaultCollection('@nrwl/next'),
    ]);
  } else if (options.preset === 'web-components') {
    return chain([
      externalSchematic('@nrwl/web', 'application', {
        name: options.name,
        style: options.style,
        linter,
      }),
      addDepsToPackageJson(
        {},
        {
          '@webcomponents/custom-elements': '1.3.2',
        }
      ),
      addPolyfills(`apps/${toFileName(options.name)}/src/polyfills.ts`, [
        '@webcomponents/custom-elements/custom-elements.min',
        '@webcomponents/custom-elements/src/native-shim',
      ]),
      setDefaultCollection('@nrwl/web'),
    ]);
  } else if (options.preset === 'angular-nest') {
    return chain([
      externalSchematic('@nrwl/angular', 'application', {
        name: options.name,
        style: options.style,
      }),
      externalSchematic('@nrwl/nest', 'application', {
        name: 'api',
        frontendProject: options.name,
      }),
      schematic('library', { name: 'api-interfaces' }, { interactive: false }),
      setDefaultCollection('@nrwl/angular'),
      connectAngularAndNest(options),
    ]);
  } else if (options.preset === 'react-express') {
    return chain([
      externalSchematic('@nrwl/react', 'application', {
        name: options.name,
        style: options.style,
        linter,
      }),
      externalSchematic('@nrwl/express', 'application', {
        name: 'api',
        frontendProject: options.name,
        linter,
      }),
      schematic(
        'library',
        { name: 'api-interfaces', linter },
        { interactive: false }
      ),
      setDefaultCollection('@nrwl/react'),
      connectReactAndExpress(options),
    ]);
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function connectAngularAndNest(options: Schema) {
  const addImportToModule = require('@nrwl/' + 'angular/src/utils/ast-utils')
    .addImportToModule;
  return (host: Tree) => {
    host.overwrite(
      'libs/api-interfaces/src/lib/api-interfaces.ts',
      `export interface Message { message: string }`
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
      ),
    ]);

    const scope = options.npmScope;
    const style = options.style ? options.style : 'css';
    host.overwrite(
      `apps/${options.name}/src/app/app.component.ts`,
      `import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Message } from '@${scope}/api-interfaces';

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
    src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
  />
</div>
<div>Message: {{ (hello$|async)|json }}</div>
    `
    );

    host.overwrite(
      `apps/api/src/app/app.controller.ts`,
      `import { Controller, Get } from '@nestjs/common';

import { Message } from '@${scope}/api-interfaces';

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
import { Message } from '@${scope}/api-interfaces';

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

function connectReactAndExpress(options: Schema) {
  return (host: Tree) => {
    const scope = options.npmScope;
    host.overwrite(
      'libs/api-interfaces/src/lib/api-interfaces.ts',
      `export interface Message { message: string }`
    );

    host.overwrite(
      `apps/${options.name}/src/app/app.tsx`,
      `import React, { useEffect, useState } from 'react';
import { Message } from '@${scope}/api-interfaces';

export const App = () => {
  const [m, setMessage] = useState<Message>({ message: '' });

  useEffect(() => {
    fetch('/api')
      .then(r => r.json())
      .then(setMessage);
  }, []);

  return (
    <>
      <div style={{ textAlign: 'center' }}>
        <h1>Welcome to ${options.name}!</h1>
        <img
          width="450"
          src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
        />
      </div>
      <div>{m.message}</div>
    </>
  );
};

export default App;
    `
    );

    host.overwrite(
      `apps/${options.name}/src/app/app.spec.tsx`,
      `import { cleanup, getByText, render, wait } from '@testing-library/react';
import React from 'react';
import App from './app';

describe('App', () => {
  afterEach(() => {
    delete global['fetch'];
    cleanup();
  });

  it('should render successfully', async () => {
    global['fetch'] = jest.fn().mockResolvedValueOnce({
      json: () => ({
        message: 'my message'
      })
    });

    const { baseElement } = render(<App />);
    await wait(() => getByText(baseElement, 'my message'));
  });
});
    `
    );

    host.overwrite(
      `apps/api/src/main.ts`,
      `import * as express from 'express';
import { Message } from '@${scope}/api-interfaces';

const app = express();

const greeting: Message = { message: 'Welcome to api!' };

app.get('/api', (req, res) => {
  res.send(greeting);
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log('Listening at http://localhost:' + port + '/api');
});
server.on('error', console.error);
    `
    );
  };
}

function setDefaultCollection(defaultCollection: string) {
  return updateWorkspaceInTree((json) => {
    if (!json.cli) {
      json.cli = {};
    }
    json.cli.defaultCollection = defaultCollection;
    return json;
  });
}

function addPolyfills(polyfillsPath: string, polyfills: string[]): Rule {
  return (host: Tree) => {
    const polyfillsSource = host.read(polyfillsPath)!.toString('utf-8');
    const polyfillsSourceFile = ts.createSourceFile(
      polyfillsPath,
      polyfillsSource,
      ts.ScriptTarget.Latest,
      true
    );

    insert(host, polyfillsPath, [
      ...addGlobal(
        polyfillsSourceFile,
        polyfillsPath,
        `\n${polyfills.map((im) => `import '${im}';`).join('\n')}\n`
      ),
    ]);
  };
}

function normalizeOptions(options: Schema): Schema {
  options.name = toFileName(options.name);
  return options;
}
