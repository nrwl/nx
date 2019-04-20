export interface Schema {
  directory: string;
  name: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  style?: string;
  preset: 'empty' | 'angular' | 'react' | 'web-components' | 'full-stack';
  commit?: { name: string; email: string; message?: string };
}
