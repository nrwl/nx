import { detectPackageManager, type Tree } from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';

// The Angular build tooling (`@angular/build`, `@angular-devkit/build-angular`,
// `ng-packagr`) pulls in esbuild, lmdb (-> msgpackr-extract) and sass
// (-> @parcel/watcher). All of them ship prebuilt binaries as optional
// dependencies, so their install scripts have nothing to do.
const angularBuildAllowBuilds = {
  esbuild: false,
  lmdb: false,
  'msgpackr-extract': false,
  '@parcel/watcher': false,
};

export function acknowledgeAngularBuildScripts(tree: Tree): void {
  acknowledgeBuildScripts(
    tree,
    detectPackageManager(tree.root),
    angularBuildAllowBuilds
  );
}
