import type { Tree } from '@nx/devkit';
import { getProjects } from '@nx/devkit';

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
