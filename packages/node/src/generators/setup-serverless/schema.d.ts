export interface SetupServerlessFunctionOptions {
  project?: string;
  platform?: ServerlessPlatforms;
  buildTarget?: string;
  deployTarget?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  site?: string;
}
export type ServerlessPlatforms = typeof serverlessPlatforms[number];

export const serverlessPlatforms = ['netlify', 'none'] as const;
