export interface ConfigurationGeneratorSchema {
  project: string;
  targetName?: string;
  engine?: 'docker' | 'podman';
  template?: 'empty' | 'nest' | 'next' | 'nginx';
  skipFormat?: boolean;
}
