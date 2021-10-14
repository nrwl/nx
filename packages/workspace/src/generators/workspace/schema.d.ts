export interface Schema {
  name: string;
  directory: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  style?: string;
  commit?: { name: string; email: string; message?: string };
  cli: 'nx' | 'angular';
  preset: string;
  defaultBase: string;
  packageManager?: string;
}
