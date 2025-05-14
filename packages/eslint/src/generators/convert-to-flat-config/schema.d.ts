export interface ConvertToFlatConfigGeneratorSchema {
  skipFormat?: boolean;
  // Internal option
  eslintConfigFormat?: 'mjs' | 'cjs';
}
