import { readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { assertRunsAgainstNxRepo } from '@nx/devkit/internal-testing-utils';
import { ExecutorConfig } from 'nx/src/config/misc-interfaces';
import executorGenerator from '../../generators/executor/executor';
import pluginGenerator from '../../generators/plugin/plugin';
import update from './specify-output-capture';

const schemaPath = `libs/plugin/src/executors/build/schema.json`;

describe('update-15-0-0-specify-output-capture', () => {
  it('should not change outputCapture if already present', async () => {
    const { tree } = await createTreeWithBoilerplate();
    updateJson(tree, schemaPath, (json) => {
      delete json.version;
      json.outputCapture = 'pipe';
      return json;
    });
    await update(tree);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).version
    ).toEqual(2);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).outputCapture
    ).toEqual('pipe');
  });

  it('should not set outputCapture if version is 2', async () => {
    const { tree } = await createTreeWithBoilerplate();
    await update(tree);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).version
    ).toEqual(2);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).outputCapture
    ).toBeUndefined();
  });

  it('should set outputCapture if version is null', async () => {
    const { tree } = await createTreeWithBoilerplate();
    updateJson(tree, schemaPath, (json) => {
      delete json.version;
      return json;
    });
    await update(tree);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).version
    ).toEqual(2);
    expect(
      readJson<ExecutorConfig['schema']>(tree, schemaPath).outputCapture
    ).toEqual('direct-nodejs');
  });

  assertRunsAgainstNxRepo(update);
});

async function createTreeWithBoilerplate() {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  await pluginGenerator(tree, {
    name: 'plugin',
    compiler: 'tsc',
    linter: Linter.EsLint,
    skipFormat: false,
    skipLintChecks: false,
    skipTsConfig: false,
    unitTestRunner: 'jest',
  });
  await executorGenerator(tree, {
    name: 'build',
    project: 'plugin',
    unitTestRunner: 'jest',
    includeHasher: false,
  });
  return { tree };
}
