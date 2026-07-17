export interface ConvertToFlatConfigGeneratorSchema {
  skipFormat?: boolean;
  // Internal option
  eslintConfigFormat?: 'mjs' | 'cjs';
  // Internal option. When true, existing ESLint-related pins in package.json are
  // preserved and only newly added packages are installed.
  keepExistingVersions?: boolean;
}
