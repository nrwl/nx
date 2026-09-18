import { logger, type Tree } from '@nx/devkit';
import { NoTargetsToMigrateError } from '@nx/devkit/internal';
import { convertToInferred } from '../../generators/convert-to-inferred/convert-to-inferred';
import { assertSupportedRemixVersion } from '../../utils/versions';

export default async function migrate(tree: Tree) {
  // The generator throws on a sub-floor Remix version, which would abort the
  // whole `nx migrate --run-migrations` batch. Pre-flight it and skip instead.
  try {
    assertSupportedRemixVersion(tree);
  } catch (error) {
    logger.warn(
      `Skipping the @nx/remix executor conversion.\n\n${
        error instanceof Error ? error.message : error
      }\n\nRun \`nx g @nx/remix:convert-to-inferred\` once Remix is on a supported version.`
    );
    return;
  }

  try {
    return await convertToInferred(tree, {});
  } catch (error) {
    if (!(error instanceof NoTargetsToMigrateError)) {
      throw error;
    }
  }
}
