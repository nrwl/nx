import { getProjects, output, type Tree } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function validateProject(tree: Tree, projectName: string): void {
  const projects = getProjects(tree);

  if (!projects.has(projectName)) {
    throw new Error(
      `Project "${projectName}" does not exist! Please provide an existing project name.`
    );
  }
}

// The below validation matches that of the Angular CLI:
// https://github.com/angular/angular-cli/blob/1316930a1cbad8e71a4454743862cfa9253bef4e/packages/schematics/angular/utility/validation.ts#L25

// See: https://github.com/tc39/proposal-regexp-unicode-property-escapes/blob/fe6d07fad74cd0192d154966baa1e95e7cda78a1/README.md#other-examples
const ecmaIdentifierNameRegExp =
  /^(?:[$_\p{ID_Start}])(?:[$_\u200C\u200D\p{ID_Continue}])*$/u;

export function validateClassName(className: string): void {
  if (!ecmaIdentifierNameRegExp.test(className)) {
    throw new Error(`Class name "${className}" is invalid.`);
  }
}

export function assertNotUsingTsSolutionSetup(
  tree: Tree,
  generatorName: string
): void {
  if (
    process.env.NX_IGNORE_UNSUPPORTED_TS_SETUP === 'true' ||
    !isUsingTsSolutionSetup(tree)
  ) {
    return;
  }

  const artifactString =
    generatorName === 'init'
      ? `"@nx/angular" plugin`
      : `"@nx/angular:${generatorName}" generator`;
  output.error({
    title: `The ${artifactString} doesn't support the existing TypeScript setup`,
    bodyLines: [
      `The Angular framework doesn't support a TypeScript setup with project references. See https://github.com/angular/angular/issues/37276 for more details.`,
      `You can ignore this error, at your own risk, by setting the "NX_IGNORE_UNSUPPORTED_TS_SETUP" environment variable to "true".`,
    ],
  });

  throw new Error(
    `The ${artifactString} doesn't support the existing TypeScript setup. See the error above.`
  );
}
