import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { stripSourceCode } from './strip-source-code';
import { createScanner, ScriptTarget, Scanner } from 'typescript';

describe('stripSourceCode', () => {
  let scanner: Scanner;
  beforeEach(() => {
    scanner = createScanner(ScriptTarget.Latest, false);
  });

  it('should work on different types of imports', () => {
    const input = `
      import * as React from "react";
      import { Component } from "react";
      import {
        Component
      } from "react"
      import {
        Component
      } from "react";
      
      import "./app.scss";

      import('./module.ts')

      const a = 1;
      export class App {}
    `;
    const expected = `import * as React from "react"
import { Component } from "react"
import {
        Component
      } from "react"
import {
        Component
      } from "react"
import "./app.scss"
import('./module.ts')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should work on different types of exports', () => {
    const input = `export * from './module';
      export {
        A
      } from './a';

      export { B } from './b';

      export { C as D } from './c';

      const a = 1;
      export class App {}
    `;
    const expected = `export * from './module'
export {
        A
      } from './a'
export { B } from './b'
export { C as D } from './c'`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should not strip files containing "loadChildren"', () => {
    const input = `const routes = [
      {
        path: 'lazy',
        loadChildren: '@nrwl/lazy'
      }
    ];`;
    expect(stripSourceCode(scanner, input)).toEqual(input);
  });
});
