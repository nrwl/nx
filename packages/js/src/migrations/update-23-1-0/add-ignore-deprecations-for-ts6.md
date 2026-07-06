#### Keep Existing Workspaces Compiling on TypeScript 6

TypeScript 6 turns several long-deprecated compiler options into hard errors and flips a few option defaults to stricter values. So that an existing workspace keeps compiling on TypeScript 6 without being migrated to a full TypeScript 6 setup, this migration makes two edits to the `tsconfig*.json` files in the workspace:

- Adds `"ignoreDeprecations": "6.0"` to any `compilerOptions` (or `ts-node.compilerOptions`) block that directly sets a TypeScript 6 deprecated option - for example `moduleResolution` set to `node`/`node10`/`classic`, `baseUrl`, `target` set to `es5`, `esModuleInterop: false`, `outFile`, `module` set to `amd`/`umd`/`system`/`none`, `alwaysStrict: false`, `allowSyntheticDefaultImports: false`, or `downlevelIteration`.
- Pins `"strict": false`, `"noUncheckedSideEffectImports": false`, `"types": ["*"]`, and `"esModuleInterop": false` on every chain-root tsconfig (one without an `extends`) that does not already set them. TypeScript 6 treats an absent `strict` as `true` (it was `false` when unset before), defaults `noUncheckedSideEffectImports` to `true` (which turns a bare side-effect import such as `import './styles.css'` without an ambient module declaration into an error), no longer auto-loads every `@types` package when `types` is unset the way TypeScript 5 did (the `"*"` wildcard restores that last default), and flips `esModuleInterop` from `false` to `true` (so an `import * as x from '<cjs>'` binds a non-callable namespace object and a call or `new` on that import fails at runtime). Pinning all four preserves the pre-TypeScript 6 behavior. Because `esModuleInterop: false` is itself a TypeScript 6 deprecated value, this pin runs before the `ignoreDeprecations` edit above, so the added `false` is silenced in the same run. It also adds `"ignoreDeprecations": "6.0"` to every chain root, even one that carries no deprecated option of its own: config-file loaders (jest, ts-node) compile files such as `jest.config.ts` with a forced `module: commonjs`, which on TypeScript 6 pairs with the deprecated `node10` resolution, and descendants inherit the chain root's flag so that config-load path keeps working. The flag is inert wherever nothing is actually deprecated.

Files that use `extends` inherit these settings from their chain root and are left untouched, and pure solution-style tsconfigs (`"files": []` with no `include`) are skipped. The migration only runs when the workspace is on TypeScript 6.

#### Sample Code Changes

##### Before

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

##### After

```json title="tsconfig.json" {6-10}
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": false,
    "noUncheckedSideEffectImports": false,
    "types": ["*"],
    "esModuleInterop": false,
    "ignoreDeprecations": "6.0"
  }
}
```
