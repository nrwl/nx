import {
  resolveSwcTranspilationTransform,
  type SwcTranspilationTransform,
} from '@nx/angular-rspack-compiler';
import { rspack } from '@rspack/core';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSwcTranspilationRules } from './swc-transpilation';

// Anchored on the package directory (the Nx vitest plugin runs tests with
// the project root as cwd) instead of the module URL so the file typechecks
// as CommonJS and runs as ESM.
const packageDir = process.cwd();
const nodeRequire = createRequire(join(packageDir, 'package.json'));

/**
 * Executes fixtures through rspack's builtin swc loader configured from a
 * tsconfig and through TypeScript itself with the options the type program
 * would use, asserting both produce the same runtime behavior. This pins the
 * semantics the swc rule must preserve for the raw TypeScript the Angular
 * compilation emits: class field assignment vs definition, legacy and
 * standard (TC39) decorators, decorator metadata, and JSX lowering for
 * `.tsx` sources.
 */
describe('swc transpilation semantics', () => {
  let dir: string;
  let caseId = 0;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'swc-semantics-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeCase(
    source: string,
    tsconfigCompilerOptions: Record<string, unknown>,
    ext = 'ts'
  ) {
    const caseDir = join(dir, `case-${caseId++}`);
    mkdirSync(caseDir, { recursive: true });
    const entry = join(caseDir, `index.${ext}`);
    writeFileSync(entry, source);
    const tsconfigPath = join(caseDir, 'tsconfig.json');
    writeFileSync(
      tsconfigPath,
      JSON.stringify({ compilerOptions: tsconfigCompilerOptions, files: [] })
    );
    return { caseDir, tsconfigPath, entry };
  }

  async function buildWithSwcRule(
    caseDir: string,
    transform: SwcTranspilationTransform,
    rspackInstance: typeof rspack = rspack,
    entry: string = join(caseDir, 'index.ts')
  ) {
    const outDir = join(caseDir, `out-${caseId++}`);
    await new Promise<void>((res, rej) => {
      rspackInstance(
        {
          mode: 'none',
          context: caseDir,
          entry,
          output: { path: outDir, filename: 'bundle.js' },
          devtool: false,
          // '.js' resolves the bundled jsx runtime the automatic-runtime case
          // pulls in; the explicit list overrides rspack's default extensions.
          resolve: { extensions: ['.ts', '.tsx', '.js'] },
          module: {
            rules: getSwcTranspilationRules(transform),
          },
        },
        (err, stats) => {
          if (err) {
            rej(err);
          } else if (stats?.hasErrors()) {
            rej(new Error(stats.toString({ errors: true, all: false })));
          } else {
            res();
          }
        }
      );
    });
    return readFileSync(join(outDir, 'bundle.js'), 'utf8');
  }

  function transpileWithTypeScript(
    source: string,
    compilerOptions: ts.CompilerOptions
  ) {
    return ts.transpileModule(source, {
      // The `.tsx` name only changes how `<` parses; no existing fixture uses
      // an angle-bracket cast, so it is safe to set unconditionally.
      fileName: 'index.tsx',
      compilerOptions: { module: ts.ModuleKind.CommonJS, ...compilerOptions },
    }).outputText;
  }

  function execute(code: string, requireFn = nodeRequire): unknown[] {
    const observations: unknown[] = [];
    const globals = globalThis as { __record__?: (v: unknown) => void };
    globals.__record__ = (v) => observations.push(v);
    const reflect = Reflect as { metadata?: unknown };
    // Minimal recording stand-in for the reflect-metadata polyfill so both
    // outputs' metadata calls become observable behavior.
    reflect.metadata = (key: string, value: unknown) => {
      return (_target: unknown, propertyKey?: string | symbol) => {
        observations.push([
          key,
          typeof value === 'function' ? value.name : value,
          propertyKey,
        ]);
      };
    };
    try {
      const moduleExports = {};
      new Function('require', 'module', 'exports', code)(
        requireFn,
        { exports: moduleExports },
        moduleExports
      );
    } finally {
      delete globals.__record__;
      delete reflect.metadata;
    }
    return observations;
  }

  const classFieldsFixture = `
    const record = (globalThis as any).__record__;
    class Base {
      get x(): number {
        return 42;
      }
      set x(value: number) {
        record(['set', value]);
      }
    }
    class Child extends Base {
      x = 1;
    }
    const child = new Child();
    record([
      'value',
      child.x,
      Object.getOwnPropertyDescriptor(child, 'x') !== undefined,
    ]);
  `;

  it('should match TypeScript class field semantics for targets below ES2022', async () => {
    const { caseDir, tsconfigPath } = writeCase(classFieldsFixture, {
      target: 'ES2020',
      experimentalDecorators: true,
    });

    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2023-11')
      )
    );
    // The type program raises the target to ES2022 with assignment
    // semantics; the ground truth uses the same forced options.
    const tsObservations = execute(
      transpileWithTypeScript(classFieldsFixture, {
        target: ts.ScriptTarget.ES2022,
        useDefineForClassFields: false,
        experimentalDecorators: true,
      })
    );

    expect(swcObservations).toEqual(tsObservations);
    expect(swcObservations).toEqual([
      ['set', 1],
      ['value', 42, false],
    ]);
  });

  it('should match TypeScript class field semantics for ES2022 targets', async () => {
    const { caseDir, tsconfigPath } = writeCase(classFieldsFixture, {
      target: 'ES2022',
      experimentalDecorators: true,
    });

    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2023-11')
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(classFieldsFixture, {
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
      })
    );

    expect(swcObservations).toEqual(tsObservations);
    expect(swcObservations).toEqual([['value', 1, true]]);
  });

  it('should emit decorator metadata like TypeScript when enabled', async () => {
    const fixture = `
      const record = (globalThis as any).__record__;
      function dec(target: any, key: string) {
        record(['dec', key]);
      }
      class Service {}
      class Consumer {
        @dec name: string = 'n';
        @dec service: Service = new Service();
      }
      new Consumer();
    `;
    const { caseDir, tsconfigPath } = writeCase(fixture, {
      target: 'ES2022',
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    });

    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2023-11')
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(fixture, {
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      })
    );

    expect(swcObservations).toEqual(tsObservations);
    expect(swcObservations).toContainEqual(['design:type', 'String', 'name']);
    expect(swcObservations).toContainEqual([
      'design:type',
      'Service',
      'service',
    ]);
  });

  const tc39Fixture = `
    const record = (globalThis as any).__record__;
    function dec(value: any, context: any) {
      record(['dec', context.kind, context.name, context.static]);
      context.addInitializer?.(function (this: any) {
        record(['init', context.kind, context.name]);
      });
      if (context.kind === 'method') {
        return function (this: any, ...args: any[]) {
          record(['call', context.name]);
          return value.call(this, ...args);
        };
      }
    }
    @dec
    class C {
      @dec f = 1;
      @dec m() {
        return 2;
      }
      @dec accessor a = 3;
      @dec static s = 4;
    }
    const c = new C();
    record(['m', c.m()]);
    record(['values', c.f, c.a, C.s]);
  `;

  it("should match TypeScript standard (TC39) decorator behavior with rspack v2's '2023-11' revision", async (ctx) => {
    const { caseDir, tsconfigPath } = writeCase(tc39Fixture, {
      target: 'ES2022',
    });

    // This package resolves rspack v1 whose bundled swc predates '2023-11';
    // exercise the revision the config selects on v2 with the workspace's
    // rspack v2 install.
    let v2Module: typeof import('@rspack/core');
    try {
      v2Module = (await import(
        pathToFileURL(
          nodeRequire.resolve('@rspack/core', {
            paths: [join(packageDir, '../..')],
          })
        ).href
      )) as typeof import('@rspack/core');
    } catch {
      return ctx.skip('workspace rspack v2 install not resolvable');
    }
    if (parseInt(v2Module.rspackVersion ?? '1', 10) < 2) {
      return ctx.skip('workspace rspack is not v2');
    }
    const rspackV2 = v2Module.rspack;

    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2023-11'),
        rspackV2
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(tc39Fixture, { target: ts.ScriptTarget.ES2022 })
    );

    expect(swcObservations).toEqual(tsObservations);
  });

  it("should keep TC39 decorator outcomes with rspack v1's '2022-03' fallback revision", async () => {
    const { caseDir, tsconfigPath } = writeCase(tc39Fixture, {
      target: 'ES2022',
    });

    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2022-03')
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(tc39Fixture, { target: ts.ScriptTarget.ES2022 })
    );

    // The '2022-03' revision applies decorators and initializers in a
    // different order than the final spec TypeScript implements, and its
    // swc emit drops field addInitializer callbacks entirely; the decorated
    // members must still end up with the same values and wrappers.
    expect(swcObservations).toContainEqual(['call', 'm']);
    expect(swcObservations).toContainEqual(['m', 2]);
    expect(swcObservations).toContainEqual(['values', 1, 3, 4]);
    expect(
      new Set(swcObservations.filter((o) => (o as unknown[])[0] === 'dec'))
    ).toEqual(
      new Set(tsObservations.filter((o) => (o as unknown[])[0] === 'dec'))
    );
  });

  it('should match TypeScript classic JSX lowering for .tsx sources', async () => {
    const jsxFixture = `
      const record = (globalThis as any).__record__;
      function h(tag: any, props: unknown, ...children: unknown[]) {
        record(['h', typeof tag === 'function' ? tag.name : tag, props, children]);
        return { tag };
      }
      function F() {}
      export const el = <div id={'a'}>hi<span>x</span></div>;
      export const frag = <>{el}</>;
    `;
    const { caseDir, tsconfigPath, entry } = writeCase(
      jsxFixture,
      {
        target: 'ES2022',
        jsx: 'react',
        jsxFactory: 'h',
        jsxFragmentFactory: 'F',
      },
      'tsx'
    );

    // These fixtures carry no decorators, so the revision does not affect the
    // JSX output; '2022-03' keeps the default rspack v1 swc from rejecting the
    // '2023-11' decorator config it does not implement.
    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2022-03'),
        rspack,
        entry
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(jsxFixture, {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        jsxFactory: 'h',
        jsxFragmentFactory: 'F',
      })
    );

    expect(swcObservations).toEqual(tsObservations);
    expect(swcObservations.length).toBeGreaterThan(0);
  });

  it('should match TypeScript automatic-runtime JSX lowering for .tsx sources', async () => {
    const jsxFixture = `
      const record = (globalThis as any).__record__;
      export const el = <div id={'a'}>hi<span>x</span></div>;
      record(['el', (el as any).type ?? '?']);
    `;
    const { caseDir, tsconfigPath, entry } = writeCase(
      jsxFixture,
      { target: 'ES2022', jsx: 'react-jsx', jsxImportSource: 'myjsx' },
      'tsx'
    );

    // Recording runtime resolved from the case dir: rspack bundles it into
    // the swc output, and the TypeScript ground truth requires it at runtime.
    const runtimeDir = join(caseDir, 'node_modules', 'myjsx');
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(
      join(runtimeDir, 'package.json'),
      JSON.stringify({ name: 'myjsx', version: '1.0.0' })
    );
    writeFileSync(
      join(runtimeDir, 'jsx-runtime.js'),
      `const record = (...a) => globalThis.__record__(...a);
exports.jsx = (t, p, k) => { record(['jsx', (t && t.name) || t, p, k]); return { type: t }; };
exports.jsxs = (t, p, k) => { record(['jsxs', (t && t.name) || t, p, k]); return { type: t }; };
exports.Fragment = Symbol.for('frag');
`
    );

    // No decorators here either; '2022-03' avoids the default rspack v1 swc
    // panic on the '2023-11' revision without changing the JSX output.
    const swcObservations = execute(
      await buildWithSwcRule(
        caseDir,
        resolveSwcTranspilationTransform(tsconfigPath, '2022-03'),
        rspack,
        entry
      )
    );
    const tsObservations = execute(
      transpileWithTypeScript(jsxFixture, {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: 'myjsx',
      }),
      createRequire(join(caseDir, 'x.js'))
    );

    expect(swcObservations).toEqual(tsObservations);
    expect(swcObservations.length).toBeGreaterThan(0);
  });
});
