export interface Schema {
  directory: string;
  name: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  packageManager?: string;
  commit?: { name: string; email: string; message?: string };
}
