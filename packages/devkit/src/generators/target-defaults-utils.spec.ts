// Stub out @nx/cypress/plugin so the dynamic `await import('@nx/cypress/plugin')`
// in addE2eCiTargetDefaults doesn't pull real plugin code (which transitively
// imports @nx/js source and inflates sandbox inputs).
jest.mock(
  '@nx/cypress/plugin',
  () => ({
    createNodesV2: ['**/cypress.config.{js,ts,mjs,cjs}', jest.fn()],
  }),
  { virtual: true }
);

import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import {
  addProjectConfiguration,
  readNxJson,
  updateNxJson,
  type NxJsonConfiguration,
  type Tree,
} from 'nx/src/devkit-exports';
import {
  addBuildTargetDefaults,
  findTargetDefault,
  updateTargetDefault,
  upsertTargetDefault,
} from './target-defaults-utils';

describe('target-defaults-utils', () => {
  describe('upsertTargetDefault', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('writes the object value form when nx.json has no targetDefaults', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;

      upsertTargetDefault(tree, nxJson, { target: 'test', cache: true });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: { cache: true },
      });
    });

    it('merges into an existing object value (config wins)', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = { test: { cache: true } };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        inputs: ['default'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: { cache: true, inputs: ['default'] },
      });
    });

    it('writes an executor-only entry under an executor key', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;

      upsertTargetDefault(tree, nxJson, {
        executor: '@nx/js:tsc',
        cache: true,
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        '@nx/js:tsc': { cache: true },
      });
    });

    it('merges a context filter with no matching entry into the generic (never authors a filtered entry)', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = { test: { cache: false } };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        plugin: '@nx/vite',
        inputs: ['vite.config.ts'],
      });
      updateNxJson(tree, nxJson);

      // No entry matches the `@nx/vite` context, so the config merges into the
      // generic; upsert never writes a new filtered entry.
      expect(readNxJson(tree).targetDefaults).toEqual({
        test: { cache: false, inputs: ['vite.config.ts'] },
      });
    });

    it('merges into an existing entry with the same filter', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [{ filter: { plugin: '@nx/vite' }, cache: true }],
      };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        plugin: '@nx/vite',
        inputs: ['vite.config.ts'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          {
            filter: { plugin: '@nx/vite' },
            cache: true,
            inputs: ['vite.config.ts'],
          },
        ],
      });
    });

    it('appends a catch-all to an existing array when upserting unfiltered', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [{ filter: { plugin: '@nx/vite' }, cache: true }],
      };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        inputs: ['default'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          { filter: { plugin: '@nx/vite' }, cache: true },
          { inputs: ['default'] },
        ],
      });
    });

    it('updates the matching filtered entry (not the generic) when the context filter matches', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [
          { cache: true },
          { filter: { plugin: '@nx/vite' }, inputs: ['old'] },
        ],
      };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        plugin: '@nx/vite',
        inputs: ['vite.config.ts'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          { cache: true },
          { filter: { plugin: '@nx/vite' }, inputs: ['vite.config.ts'] },
        ],
      });
    });

    it('updates the generic when the context filter matches no existing entry', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [
          { cache: true },
          { filter: { plugin: '@nx/vite' }, inputs: ['vite'] },
        ],
      };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        plugin: '@nx/jest',
        inputs: ['jest'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          { cache: true, inputs: ['jest'] },
          { filter: { plugin: '@nx/vite' }, inputs: ['vite'] },
        ],
      });
    });

    it('updates a `projects` filtered entry that covers the configured project (by tag)', () => {
      addProjectConfiguration(tree, 'app-a', {
        root: 'apps/app-a',
        tags: ['unit'],
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [
          { cache: true },
          { filter: { projects: ['tag:unit'] }, inputs: ['old'] },
        ],
      };

      // Configuring `app-a` (which has `tag:unit`) — the filtered entry covers
      // it, so it is the one updated.
      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        projects: ['app-a'],
        inputs: ['new'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          { cache: true },
          { filter: { projects: ['tag:unit'] }, inputs: ['new'] },
        ],
      });
    });

    it('updates the generic when no `projects` filtered entry covers the configured project', () => {
      addProjectConfiguration(tree, 'app-b', {
        root: 'apps/app-b',
        tags: ['e2e'],
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: [
          { cache: true },
          { filter: { projects: ['tag:unit'] }, inputs: ['old'] },
        ],
      };

      // `app-b` lacks `tag:unit`, so the filtered entry does not cover it.
      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        projects: ['app-b'],
        inputs: ['new'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: [
          { cache: true, inputs: ['new'] },
          { filter: { projects: ['tag:unit'] }, inputs: ['old'] },
        ],
      });
    });

    it('downgrades a single unfiltered array entry back to the object form', () => {
      const nxJson = readNxJson(tree);
      // A hand-authored single-element array with no filter is equivalent to
      // the plain object form; merging into it should collapse it back.
      nxJson.targetDefaults = { test: [{ cache: true }] };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        inputs: ['default'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: { cache: true, inputs: ['default'] },
      });
    });

    it('keeps an executor used with a target as a config field (object form)', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        executor: '@nx/jest:jest',
        inputs: ['jest.config.ts'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual({
        test: { executor: '@nx/jest:jest', inputs: ['jest.config.ts'] },
      });
    });

    it('throws when neither target nor executor is set', () => {
      const nxJson = readNxJson(tree);
      expect(() =>
        upsertTargetDefault(tree, nxJson, { cache: true } as any)
      ).toThrow(/at least one of `target` or `executor`/);
    });
  });

  describe('findTargetDefault', () => {
    it('finds an unfiltered entry by target across the object form', () => {
      expect(
        findTargetDefault(
          { build: { cache: true }, test: { cache: false } },
          { target: 'build' }
        )
      ).toEqual({ target: 'build', cache: true });
    });

    it('finds a filtered entry inside an array value', () => {
      expect(
        findTargetDefault(
          {
            test: [
              { cache: false },
              { filter: { plugin: '@nx/vite' }, inputs: ['vite.config.ts'] },
            ],
          },
          { target: 'test', plugin: '@nx/vite' }
        )
      ).toEqual({
        target: 'test',
        plugin: '@nx/vite',
        inputs: ['vite.config.ts'],
      });
    });

    it('returns undefined when no entry matches the locator', () => {
      expect(
        findTargetDefault({ build: { cache: true } }, { target: 'test' })
      ).toBeUndefined();
    });

    it('throws on an empty locator', () => {
      expect(() => findTargetDefault({ build: { cache: true } }, {})).toThrow(
        /at least one of/
      );
    });
  });

  describe('addBuildTargetDefaults', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('adds an executor-keyed cache default', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/esbuild:esbuild');

      expect(readNxJson(tree).targetDefaults).toEqual({
        '@nx/esbuild:esbuild': {
          cache: true,
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      });
    });

    it('does not duplicate an existing unfiltered executor default', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = { '@nx/esbuild:esbuild': { cache: true } };
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/esbuild:esbuild');

      expect(readNxJson(tree).targetDefaults).toEqual({
        '@nx/esbuild:esbuild': { cache: true },
      });
    });
  });

  describe('updateTargetDefault', () => {
    // Strips the bad option, mirroring the jest tsConfig-removal migration.
    const removeTsConfig = (config: { options?: Record<string, unknown> }) => {
      if (config.options) {
        delete config.options.tsConfig;
        if (Object.keys(config.options).length === 0) delete config.options;
      }
    };

    it('runs the callback for object, executor-key, field, and filter forms that reference the executor', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          // target-key with the executor as a config field
          build: {
            executor: '@nx/jest:jest',
            options: { tsConfig: 'x', a: 1 },
          },
          // executor-key form
          '@nx/jest:jest': { options: { tsConfig: 'y', b: 2 } },
          test: [
            // target-key with the executor in the filter
            {
              filter: { executor: '@nx/jest:jest' },
              options: { tsConfig: 'z', c: 3 },
            },
            // unrelated entry — untouched
            { options: { keep: true } },
          ],
          // unrelated key — untouched
          lint: { options: { tsConfig: 'should-stay' } },
        },
      };

      updateTargetDefault(
        nxJson,
        { executor: '@nx/jest:jest' },
        removeTsConfig
      );

      expect(nxJson.targetDefaults).toEqual({
        build: { executor: '@nx/jest:jest', options: { a: 1 } },
        '@nx/jest:jest': { options: { b: 2 } },
        test: [
          { filter: { executor: '@nx/jest:jest' }, options: { c: 3 } },
          { options: { keep: true } },
        ],
        lint: { options: { tsConfig: 'should-stay' } },
      });
    });

    it('passes the right info (target/executor/filter) per entry form', () => {
      const seen: Array<Record<string, unknown>> = [];
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          build: { executor: '@nx/jest:jest', cache: true },
          '@nx/jest:jest': { cache: true },
          test: [{ filter: { executor: '@nx/jest:jest' }, cache: true }],
        },
      };

      updateTargetDefault(
        nxJson,
        { executor: '@nx/jest:jest' },
        (_config, info) => {
          seen.push({
            key: info.key,
            target: info.target,
            executor: info.executor,
            filter: info.filter,
          });
        }
      );

      expect(seen).toEqual([
        {
          key: 'build',
          target: 'build',
          executor: '@nx/jest:jest',
          filter: undefined,
        },
        {
          key: '@nx/jest:jest',
          target: undefined,
          executor: '@nx/jest:jest',
          filter: undefined,
        },
        {
          key: 'test',
          target: 'test',
          executor: '@nx/jest:jest',
          filter: { executor: '@nx/jest:jest' },
        },
      ]);
    });

    it('drops an array entry whose callback returns null and collapses to the object form', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          test: [
            {
              filter: { executor: '@nx/jest:jest' },
              options: { tsConfig: 'z' },
            },
            { cache: true },
          ],
        },
      };

      updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, () => null);

      // The filtered jest entry is dropped; the lone unfiltered entry collapses
      // back to the plain object form.
      expect(nxJson.targetDefaults).toEqual({ test: { cache: true } });
    });

    it('deletes the key when an object-form value callback returns null', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          '@nx/jest:jest': { options: { tsConfig: 'z' } },
          build: { cache: true },
        },
      };

      updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, () => null);

      expect(nxJson.targetDefaults).toEqual({ build: { cache: true } });
    });

    it('removes targetDefaults entirely when the last key is deleted', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: { '@nx/jest:jest': { options: { tsConfig: 'z' } } },
      };

      updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, () => null);

      expect(nxJson.targetDefaults).toBeUndefined();
    });

    it('replaces the entry payload when the callback returns a new config', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: { '@nx/jest:jest': { cache: true } },
      };

      updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, (config) => ({
        ...config,
        cache: false,
        inputs: ['production'],
      }));

      expect(nxJson.targetDefaults).toEqual({
        '@nx/jest:jest': { cache: false, inputs: ['production'] },
      });
    });

    it('narrows to project-filtered entries that cover the scoped projects', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          build: [
            { filter: { projects: ['app-a'] }, options: { a: 1 } },
            { filter: { projects: ['tag:unit'] }, options: { b: 2 } },
            { filter: { projects: ['other'] }, options: { c: 3 } },
            { options: { d: 4 } },
          ],
        },
      };

      updateTargetDefault(
        nxJson,
        {
          projects: {
            'app-a': { data: { root: 'apps/app-a', tags: ['unit'] } },
          },
        },
        (config) => {
          (config.options as Record<string, unknown>).touched = true;
        }
      );

      // app-a is matched by name and by `tag:unit`, and the unfiltered entry
      // always applies; the `other`-scoped entry is left alone.
      expect(nxJson.targetDefaults).toEqual({
        build: [
          { filter: { projects: ['app-a'] }, options: { a: 1, touched: true } },
          {
            filter: { projects: ['tag:unit'] },
            options: { b: 2, touched: true },
          },
          { filter: { projects: ['other'] }, options: { c: 3 } },
          { options: { d: 4, touched: true } },
        ],
      });
    });

    it('combines executor selection with project narrowing', () => {
      const nxJson: NxJsonConfiguration = {
        targetDefaults: {
          test: [
            {
              filter: { executor: '@nx/jest:jest', projects: ['app-a'] },
              options: { a: 1 },
            },
            {
              filter: { executor: '@nx/jest:jest', projects: ['other'] },
              options: { b: 2 },
            },
            { filter: { executor: '@nx/jest:jest' }, options: { c: 3 } },
            { filter: { executor: '@nx/vite:test' }, options: { d: 4 } },
          ],
        },
      };

      updateTargetDefault(
        nxJson,
        {
          executor: '@nx/jest:jest',
          projects: { 'app-a': { data: { root: 'apps/app-a' } } },
        },
        (config) => {
          (config.options as Record<string, unknown>).touched = true;
        }
      );

      expect(nxJson.targetDefaults).toEqual({
        test: [
          {
            filter: { executor: '@nx/jest:jest', projects: ['app-a'] },
            options: { a: 1, touched: true },
          },
          {
            filter: { executor: '@nx/jest:jest', projects: ['other'] },
            options: { b: 2 },
          },
          {
            filter: { executor: '@nx/jest:jest' },
            options: { c: 3, touched: true },
          },
          { filter: { executor: '@nx/vite:test' }, options: { d: 4 } },
        ],
      });
    });

    it('throws when neither executor nor projects is provided', () => {
      expect(() =>
        updateTargetDefault({ targetDefaults: {} }, {}, () => null)
      ).toThrow(/at least one of `executor` or `projects`/);
    });

    it('is a no-op when nx.json has no targetDefaults', () => {
      const nxJson: NxJsonConfiguration = {};
      expect(
        updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, () => null)
      ).toBe(nxJson);
      expect(nxJson.targetDefaults).toBeUndefined();
    });
  });
});
