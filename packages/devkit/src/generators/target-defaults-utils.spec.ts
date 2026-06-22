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
  type Tree,
} from 'nx/src/devkit-exports';
import {
  addBuildTargetDefaults,
  findTargetDefault,
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
        projects: 'app-a',
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
        projects: 'app-b',
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
});
