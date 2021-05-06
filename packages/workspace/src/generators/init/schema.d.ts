export interface Schema {
  name: string;
  skipInstall?: boolean;
  npmScope?: string;
  preserveAngularCLILayout?: boolean;
  defaultBase?: string;
}
