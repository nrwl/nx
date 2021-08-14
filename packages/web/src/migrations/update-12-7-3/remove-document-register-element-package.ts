import type { Tree } from '@nrwl/devkit';
import { removeDependenciesFromPackageJson } from '@nrwl/devkit';

export const removeDocumentRegisterElementPackage = async (host: Tree) =>
  removeDependenciesFromPackageJson(host, ['document-register-element']);

export default removeDocumentRegisterElementPackage;
