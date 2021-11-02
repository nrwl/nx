// This file is required by karma.conf.js and loads recursively all the .spec and framework files
import 'core-js/proposals/reflect-metadata';
import 'zone.js/dist/zone';
import 'zone.js/dist/zone-testing';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Unfortunately there's no typing for the `__karma__` variable. Just declare it as any.
declare const require: any;

// Prevent Karma from running prematurely.
declare const __karma__: any;
__karma__.loaded = function () {};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

const context = (<any>require).context(
  './packages/angular/spec',
  true,
  /\.spec\.js$/
);
// And load the modules.
context.keys().map(context);
// Finally, start Karma to run the tests.
__karma__.start();
