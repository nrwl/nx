export interface Schema {
  name: string;
  directory: string;
  npmScope?: string;
  version?: string;
  prefix?: string;
  style?: string;
  minimal?: boolean;
  skipInstall?: boolean;
  commit?: { name: string, email: string, message?: string };
  skipGit?: boolean;
}
