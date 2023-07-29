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

      function inside() {
        import('./module.ts')
      }
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
      export type { B } from './b';

      export { C as D } from './c';

      const a = 1;
      export class App {}
    `;
    const expected = `export * from './module'
export {
        A
      } from './a'
export { B } from './b'
export type { B } from './b'
export { C as D } from './c'`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should work on dependencies made with the require keyword', () => {
    const input = `require('./a');
      
      require('./b');
      const c = require('./c');

      const a = 1;
      export class App {}
    `;
    const expected = `require('./a')
require('./b')
require('./c')`;

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

  it('should strip static imports that have nx-ignore-next-line comment above them', () => {
    const input = `
      // nx-ignore-next-line
      import * as React from "react";
      import { Component } from "react";
      import {
        Component
      } from "react"
      import {
        Component
      } from "react";
      
      // nx-ignore-next-line
      import "./app.scss";

      import('./module.ts')

      const a = 1;
      export class App {}
    `;
    const expected = `import { Component } from "react"
import {
        Component
      } from "react"
import {
        Component
      } from "react"
import('./module.ts')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should strip dynamic imports that have nx-ignore-next-line comment above them', () => {
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
      // nx-ignore-next-line
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
import "./app.scss"`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should strip exports that have nx-ignore-next-line comment above them', () => {
    const input = `export * from './module';
      export {
        A
      } from './a';

      // nx-ignore-next-line
      export { B } from './b';

      export { C as D } from './c';

      const a = 1;
      export class App {}
    `;
    const expected = `export * from './module'
export {
        A
      } from './a'
export { C as D } from './c'`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should strip dependencies made with the require keyword that have nx-ignore-next-line above them', () => {
    const input = `require('./a');
      // nx-ignore-next-line
      const b = require('./b');
      const c = require('./c');

      const a = 1;
      export class App {}
    `;
    const expected = `require('./a')
require('./c')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should not strip an import if the next line of code after an nx-ignore-next-line comment is not an import', () => {
    const input = `
      // nx-ignore-next-line
      const a = 1;
      import('./module.ts')

      export class App {}
    `;
    const expected = `import('./module.ts')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should not strip an export if the next line of code after an nx-ignore-next-line comment is not an export', () => {
    const input = `export * from './module';
      export {
        A
      } from './a';

      // nx-ignore-next-line
      const a = 1;
      export { B } from './b';

      export { C as D } from './c';

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

  it('should not strip a dependency made with the require keyword if the next line of code after an nx-ignore-next-line comment is not a require keyword', () => {
    const input = `require('./a');
      // nx-ignore-next-line
      const a = 1;
      require('./b');
      const c = require('./c');

      export class App {}
    `;
    const expected = `require('./a')
require('./b')
require('./c')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should find an import after a template literal with a variable in it', () => {
    const input = `
      const a = 1;
      const b = \`a: $\{a}\`
      const c = await import('./c')
      const d = require('./d')
    `;
    const expected = `import('./c')
require('./d')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('should find an import after a template literal with a 2 variables in it', () => {
    const input = `
      const a = 1;
      const b = 2;
      const c = \`a: $\{a}, b: $\{b}\`
      const d = await import('./d')
      const e = require('./e')
    `;
    const expected = `import('./d')
require('./e')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('finds imports after an escaped character', () => {
    const input = `
      const b = unquotedLiteral.replace(/"/g, '\\\\"')
      const c = await import('./c')
      const d = require('./d')
    `;
    const expected = `import('./c')
require('./d')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('finds imports after template literals with a regex inside', () => {
    const input = `
      const a = 1;
      const b = \`"$\{unquotedLiteral.replace(/"/g, '\\\\"')}"\`
      const c = await import('./c')
      const d = require('./d')
    `;
    const expected = `import('./c')
require('./d')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('finds imports in the same line as template literals with division inside', () => {
    const input = `
      const a = 1;
      const b = \`"$\{1 / 2} $\{await import('./b')} $\{await require('./c')}"\`;
    `;
    const expected = `import('./b')
require('./c')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('finds imports in the same line after a regex', () => {
    const input = `
      const a = 1;
      const b = /"/g; const c = await import('./c'); const d = require('./d')
    `;
    const expected = `import('./c')
require('./d')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });

  it('finds imports inside template literals', () => {
    const input = `
      const a = \`"$\{require('./a')}"\`
      const b = \`"$\{await import('./b')}"\`
    `;
    const expected = `require('./a')
import('./b')`;

    expect(stripSourceCode(scanner, input)).toEqual(expected);
  });
});
