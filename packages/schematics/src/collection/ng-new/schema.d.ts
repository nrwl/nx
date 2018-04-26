export interface Schema {
  directory: string;
  name: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  commit?: { name: string; email: string; message?: string };
}
