// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export {
  nxVersion,
  minSupportedNextVersion,
  next16Version,
  next15Version,
  next14Version,
  nextVersion,
  eslintConfigNext16Version,
  eslintConfigNext15Version,
  eslintConfigNext14Version,
  eslintConfigNextVersion,
  sassVersion,
  tsLibVersion,
} from './src/utils/versions';
