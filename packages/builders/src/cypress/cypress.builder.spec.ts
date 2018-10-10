import CypressBuilder, { CypressBuilderOptions } from './cypress.builder';
import { TestLogger } from '@angular-devkit/architect/testing';
import { normalize } from '@angular-devkit/core';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as path from 'path';
const Cypress = require('cypress');

describe('Cypress builder', () => {
  let builder: CypressBuilder;
  const cypressBuilderOptions: CypressBuilderOptions = {
    cypressConfig: 'apps/my-app-e2e/cypress.json',
    tsConfig: 'apps/my-app-e2e/tsconfig.json',
    devServerTarget: 'my-app:serve',
    headless: true
  };

  beforeEach(() => {
    builder = new CypressBuilder({
      host: <any>{},
      logger: new TestLogger('test'),
      workspace: <any>{
        root: '/root'
      },
      architect: <any>{}
    });
  });

  describe('run', () => {
    it('should call `spawn.child_process` with the tsc command', () => {
      const fakeEventEmitter = new EventEmitter();
      const spawn = spyOn(child_process, 'spawn').and.returnValue(
        fakeEventEmitter
      );

      builder
        .run({
          root: normalize('/root'),
          projectType: 'application',
          builder: '@nrwl/builders:cypress',
          options: cypressBuilderOptions
        })
        .subscribe(() => {
          expect(spawn).toHaveBeenCalledWith(
            '/root/node_modules/.bin/tsc',
            cypressBuilderOptions.tsConfig,
            { stdio: [0, 1, 2] }
          );
        });

      fakeEventEmitter.emit('exit');
    });

    it('should call `Cypress.run` if headless mode is `true`', () => {
      const fakeEventEmitter = new EventEmitter();
      spyOn(child_process, 'spawn').and.returnValue(fakeEventEmitter);
      const cypressRun = spyOn(Cypress, 'run');
      const cypressOpen = spyOn(Cypress, 'open');

      builder
        .run({
          root: normalize('/root'),
          projectType: 'application',
          builder: '@nrwl/builders:cypress',
          options: cypressBuilderOptions
        })
        .subscribe(() => {
          expect(cypressRun).toHaveBeenCalledWith({
            config: { baseUrl: 'http://localhost:4200' },
            project: path.dirname(cypressBuilderOptions.cypressConfig)
          });
          expect(cypressOpen).not.toHaveBeenCalled();
        });

      fakeEventEmitter.emit('exit'); // Passing tsc command
    });

    it('should call `Cypress.open` if headless mode is `false`', () => {
      const fakeEventEmitter = new EventEmitter();
      spyOn(child_process, 'spawn').and.returnValue(fakeEventEmitter);
      const cypressRun = spyOn(Cypress, 'run');
      const cypressOpen = spyOn(Cypress, 'open');

      builder
        .run({
          root: normalize('/root'),
          projectType: 'application',
          builder: '@nrwl/builders:cypress',
          options: Object.assign(cypressBuilderOptions, { headless: false })
        })
        .subscribe(() => {
          expect(cypressOpen).toHaveBeenCalledWith({
            config: { baseUrl: 'http://localhost:4200' },
            project: path.dirname(cypressBuilderOptions.cypressConfig)
          });
          expect(cypressRun).not.toHaveBeenCalled();
        });

      fakeEventEmitter.emit('exit'); // Passing tsc command
    });
  });
});
