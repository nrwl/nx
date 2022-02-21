export interface Schema {
  name: string;
  skipInstall?: boolean;
  npmScope?: string;
  preserveAngularCliLayout?: boolean;
  defaultBase?: string;
}
