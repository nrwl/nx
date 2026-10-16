import {
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getPresetExt } from '../../../utils/config/config-file';
import { jestInitGenerator } from '../../init/init';
import { writeRootJestPreset } from './create-jest-config';
import { ensureDependencies } from './ensure-dependencies';

/**
 * Sets up the root preset and swc dependencies for a project that ships its
 * own jest config, such as an e2e project in a workspace without Jest.
 */
export async function ensureRootJest(tree: Tree): Promise<GeneratorCallback> {
  const initTask = await jestInitGenerator(tree, {
    skipFormat: true,
  });
  writeRootJestPreset(tree, getPresetExt(tree));
  const depsTask = ensureDependencies(tree, {
    compiler: 'swc',
    testEnvironment: 'node',
  });
  return runTasksInSerial(initTask, depsTask);
}
