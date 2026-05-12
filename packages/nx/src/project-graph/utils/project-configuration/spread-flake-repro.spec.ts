import { mergeTargetConfigurations } from './target-merging';
import { mergeProjectConfigurationIntoRootMap } from './project-nodes-manager';
import { validateAndNormalizeProjectRootMap } from './target-normalization';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';

// Reproduces the e2e failure: spread.test.ts
// "should resolve spread when middle specified plugin contains '...'".

const ROOT = 'libs/test-lib';
const baseTargetShape = {
  executor: 'nx:run-commands' as const,
  options: { command: 'echo build' },
};

const pluginFirstProject: ProjectConfiguration = {
  root: ROOT,
  targets: { build: { ...baseTargetShape, inputs: ['from-first'] } },
};
const pluginMiddleProject: ProjectConfiguration = {
  root: ROOT,
  targets: { build: { ...baseTargetShape, inputs: ['from-middle', '...'] } },
};
const pluginLastProject: ProjectConfiguration = {
  root: ROOT,
  targets: { build: { ...baseTargetShape, inputs: ['from-last'] } },
};

describe('spread-flake-repro: three-layer chain, middle plugin uses "..."', () => {
  // Harness 1: pure target-merging. Already shown to pass.
  it('Harness 1 — mergeTargetConfigurations chain produces ["from-last"]', () => {
    const r1 = mergeTargetConfigurations(
      pluginFirstProject.targets.build,
      undefined
    );
    const r2 = mergeTargetConfigurations(pluginMiddleProject.targets.build, r1);
    const r3 = mergeTargetConfigurations(pluginLastProject.targets.build, r2);

    expect(r3).toBeDefined();
    expect(r3.inputs).toEqual(['from-last']);
  });

  // Harness 2: one level up — go through mergeProjectConfigurationIntoRootMap.
  // This is what the real specified-plugin pipeline does (mergeToManager).
  it('Harness 2 — three sequential specified plugins via mergeProjectConfigurationIntoRootMap', () => {
    const rootMap: Record<string, ProjectConfiguration> = {};

    mergeProjectConfigurationIntoRootMap(rootMap, pluginFirstProject);
    mergeProjectConfigurationIntoRootMap(rootMap, pluginMiddleProject);
    mergeProjectConfigurationIntoRootMap(rootMap, pluginLastProject);

    expect(rootMap[ROOT]).toBeDefined();
    expect(rootMap[ROOT].targets).toBeDefined();
    expect(rootMap[ROOT].targets.build).toBeDefined();
    expect(rootMap[ROOT].targets.build.inputs).toEqual(['from-last']);
  });

  // Harness 3: simulate the empty project.json pre-pass.
  // The e2e test clears `c.targets = {}` on project.json, then plugins run.
  // The project-json default plugin emits `{root, name, targets: {}}` first.
  it('Harness 3 — empty-targets project.json THEN three specified plugins', () => {
    const rootMap: Record<string, ProjectConfiguration> = {};

    // Default plugin reading the cleared project.json
    mergeProjectConfigurationIntoRootMap(rootMap, {
      root: ROOT,
      name: 'test-lib',
      targets: {},
    });

    mergeProjectConfigurationIntoRootMap(rootMap, pluginFirstProject);
    mergeProjectConfigurationIntoRootMap(rootMap, pluginMiddleProject);
    mergeProjectConfigurationIntoRootMap(rootMap, pluginLastProject);

    expect(rootMap[ROOT]).toBeDefined();
    expect(rootMap[ROOT].targets.build).toBeDefined();
    expect(rootMap[ROOT].targets.build.inputs).toEqual(['from-last']);
  });

  // Harness 4: simulate the intermediate-default-overlay pipeline.
  // Real pipeline: specified plugins merge into `nodesManager.rootMap` with
  // deferSpreadsWithoutBase=false, default plugins merge into
  // `intermediateDefaultRootMap` with deferSpreadsWithoutBase=true, then the
  // intermediate is overlaid back onto the main rootMap.
  it('Harness 4 — full pipeline with intermediate-default overlay', () => {
    const mainRootMap: Record<string, ProjectConfiguration> = {};
    const intermediateRootMap: Record<string, ProjectConfiguration> = {};

    // Step 1: specified plugins (deferSpreadsWithoutBase=false)
    for (const p of [
      pluginFirstProject,
      pluginMiddleProject,
      pluginLastProject,
    ]) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        p,
        undefined,
        undefined,
        false,
        false
      );
    }

    // Step 2: default plugins (deferSpreadsWithoutBase=true). The
    // project-json default plugin sees the cleared targets:
    mergeProjectConfigurationIntoRootMap(
      intermediateRootMap,
      { root: ROOT, name: 'test-lib', targets: {} },
      undefined,
      undefined,
      false,
      true
    );

    // Step 4: overlay intermediate onto main (no defer)
    for (const root in intermediateRootMap) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        intermediateRootMap[root],
        undefined,
        undefined
      );
    }

    expect(mainRootMap[ROOT]).toBeDefined();
    expect(mainRootMap[ROOT].targets.build).toBeDefined();
    expect(mainRootMap[ROOT].targets.build.inputs).toEqual(['from-last']);
  });

  // Harness 5: full pipeline + the validation/normalization step.
  // target-normalization.ts:139-152 DELETES targets that lack both
  // executor and command. If anything upstream loses `executor` on the
  // merged build target, this is where it would be dropped — which would
  // exactly match the e2e symptom (`targets.build` undefined).
  it('Harness 5 — full pipeline + validateAndNormalizeProjectRootMap', () => {
    const mainRootMap: Record<string, ProjectConfiguration> = {};
    const intermediateRootMap: Record<string, ProjectConfiguration> = {};

    for (const p of [
      pluginFirstProject,
      pluginMiddleProject,
      pluginLastProject,
    ]) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        p,
        undefined,
        undefined,
        false,
        false
      );
    }
    mergeProjectConfigurationIntoRootMap(
      intermediateRootMap,
      { root: ROOT, name: 'test-lib', targets: {} },
      undefined,
      undefined,
      false,
      true
    );
    for (const root in intermediateRootMap) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        intermediateRootMap[root],
        undefined,
        undefined
      );
    }

    // The actual normalization step that the prod pipeline runs after merging.
    validateAndNormalizeProjectRootMap(
      '/tmp/fake-workspace',
      mainRootMap,
      { plugins: [] },
      {}
    );

    expect(mainRootMap[ROOT]).toBeDefined();
    expect(mainRootMap[ROOT].targets.build).toBeDefined();
    expect(mainRootMap[ROOT].targets.build.inputs).toEqual(['from-last']);
  });

  // Harness 6: what if a default plugin (like package-json reading the
  // generator-emitted package.json) also emits a build target with a
  // DIFFERENT command? Different commands ⇒ isCompatibleTarget=false ⇒
  // mergeBase zeros to {} ⇒ only target's keys flow through. If the
  // default-plugin's build target only has options.command and no
  // explicit executor, the merged result may lose executor entirely.
  it('Harness 6 — intermediate has incompatible build target (diff command)', () => {
    const mainRootMap: Record<string, ProjectConfiguration> = {};
    const intermediateRootMap: Record<string, ProjectConfiguration> = {};

    for (const p of [
      pluginFirstProject,
      pluginMiddleProject,
      pluginLastProject,
    ]) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        p,
        undefined,
        undefined,
        false,
        false
      );
    }

    // Simulate package-json default plugin emitting build with diff command.
    mergeProjectConfigurationIntoRootMap(
      intermediateRootMap,
      {
        root: ROOT,
        name: 'test-lib',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'tsc -b' },
          },
        },
      },
      undefined,
      undefined,
      false,
      true
    );

    for (const root in intermediateRootMap) {
      mergeProjectConfigurationIntoRootMap(
        mainRootMap,
        intermediateRootMap[root],
        undefined,
        undefined
      );
    }

    validateAndNormalizeProjectRootMap(
      '/tmp/fake-workspace',
      mainRootMap,
      { plugins: [] },
      {}
    );

    // We don't know what the right answer is here; we're just observing
    // what the pipeline does to the build target.
    // eslint-disable-next-line no-console
    console.log(
      'Harness 6 result:',
      JSON.stringify(mainRootMap[ROOT].targets, null, 2)
    );

    expect(mainRootMap[ROOT]).toBeDefined();
    // Just check the target survived — content may differ.
    expect(mainRootMap[ROOT].targets.build).toBeDefined();
  });
});
