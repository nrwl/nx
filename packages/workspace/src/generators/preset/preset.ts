import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  installPackagesTask,
  names,
  PackageManager,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { Schema } from './schema';

import { libraryGenerator } from '../library/library';

import { insertImport } from '../utils/insert-import';
import { insertStatement } from '../utils/insert-statement';
import { Preset } from '../utils/presets';
import { join } from 'path';

export async function presetGenerator(tree: Tree, options: Schema) {
  options = normalizeOptions(options);
  await createPreset(tree, options);
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}

export const presetSchematic = convertNxGenerator(presetGenerator);
export default presetGenerator;

async function createPreset(tree: Tree, options: Schema) {
  if (options.preset === Preset.Empty || options.preset === Preset.Apps) {
    return;
  } else if (options.preset === Preset.Angular) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nrwl' + '/angular/generators');

    await angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.React) {
    const {
      applicationGenerator: reactApplicationGenerator,
    } = require('@nrwl' + '/react');

    await reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.NextJs) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nrwl' +
      '/next');

    await nextApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.WebComponents) {
    const { applicationGenerator: webApplicationGenerator } = require('@nrwl' +
      '/web');

    await webApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@ungap/custom-elements': '0.1.6',
      }
    );
    addPolyfills(
      tree,
      `apps/${names(options.name).fileName}/src/polyfills.ts`,
      ['@ungap/custom-elements']
    );
  } else if (options.preset === Preset.AngularWithNest) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nrwl' + '/angular/generators');
    const { applicationGenerator: nestApplicationGenerator } = require('@nrwl' +
      '/nest');

    await angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      skipFormat: true,
      standaloneConfig: options.standaloneConfig,
    });
    await nestApplicationGenerator(tree, {
      name: 'api',
      frontendProject: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    await libraryGenerator(tree, {
      name: 'api-interfaces',
      unitTestRunner: 'none',
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    connectAngularAndNest(tree, options);
  } else if (options.preset === Preset.ReactWithExpress) {
    const {
      applicationGenerator: expressApplicationGenerator,
    } = require('@nrwl' + '/express');
    const {
      applicationGenerator: reactApplicationGenerator,
    } = require('@nrwl' + '/react');

    await reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    await expressApplicationGenerator(tree, {
      name: 'api',
      frontendProject: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    await libraryGenerator(tree, {
      name: 'api-interfaces',
      unitTestRunner: 'none',
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
    connectReactAndExpress(tree, options);
  } else if (options.preset === Preset.Nest) {
    const { applicationGenerator: nestApplicationGenerator } = require('@nrwl' +
      '/nest');

    await nestApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
    });
  } else if (options.preset === Preset.Express) {
    const {
      applicationGenerator: expressApplicationGenerator,
    } = require('@nrwl' + '/express');
    await expressApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === 'react-native') {
    const { reactNativeApplicationGenerator } = require('@nrwl' +
      '/react-native');
    await reactNativeApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      e2eTestRunner: 'detox',
    });
  } else if (options.preset === Preset.Core || options.preset === Preset.NPM) {
    setupPackageManagerWorkspaces(tree, options);
    if (options.preset === Preset.Core) {
      tree.delete('workspace.json');
    }
  } else if (options.preset === Preset.TS) {
    const c = readWorkspaceConfiguration(tree);
    c.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateWorkspaceConfiguration(tree, c);
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function setupPackageManagerWorkspaces(tree: Tree, options: Schema) {
  if (options.packageManager === 'pnpm') {
    generateFiles(tree, join(__dirname, './files/pnpm-workspace'), '.', {});
  } else {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/**'];
      return json;
    });
  }
}

function connectAngularAndNest(host: Tree, options: Schema) {
  const { insertNgModuleImport } = require('@nrwl' +
    '/angular/src/generators/utils');
  host.write(
    'libs/api-interfaces/src/lib/api-interfaces.ts',
    `export interface Message { message: string }`
  );

  const modulePath = `apps/${options.name}/src/app/app.module.ts`;

  insertImport(host, modulePath, 'HttpClientModule', '@angular/common/http');

  insertNgModuleImport(host, modulePath, 'HttpClientModule');

  const scope = options.npmScope;
  const style = options.style ?? 'css';
  host.write(
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

  host.write(
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

  host.write(
    `apps/${options.name}/src/app/app.component.html`,
    `<div style="text-align:center">
  <h1>Welcome to ${options.name}!</h1>
  <img
    width="450"
    src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
    alt="Nx - Smart, Fast and Extensible Build System"
  />
</div>
<div>Message: {{ (hello$|async)|json }}</div>
    `
  );

  host.write(
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

  host.write(
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
}

function connectReactAndExpress(host: Tree, options: Schema) {
  const scope = options.npmScope;
  host.write(
    'libs/api-interfaces/src/lib/api-interfaces.ts',
    `export interface Message { message: string }`
  );

  host.write(
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
          alt="Nx - Smart, Fast and Extensible Build System"
        />
      </div>
      <div>{m.message}</div>
    </>
  );
};

export default App;
    `
  );

  host.write(
    `apps/${options.name}/src/app/app.spec.tsx`,
    `import { cleanup, getByText, render, waitFor } from '@testing-library/react';
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
    await waitFor(() => getByText(baseElement, 'my message'));
  });
});
    `
  );

  host.write(
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
}

function addPolyfills(host: Tree, polyfillsPath: string, polyfills: string[]) {
  for (const polyfill of polyfills) {
    insertStatement(host, polyfillsPath, `import '${polyfill}';\n`);
  }
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  return options;
}
