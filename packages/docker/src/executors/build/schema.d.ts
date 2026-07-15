export interface ContainerMetadataSchema {
  images?: string[];
  tags?: string[];
  flavor?: string[];
  labels?: string[];
  annotations?: string[];
  'sep-tags'?: string;
  'sep-labels'?: string;
  'bake-target'?: string;
}

export interface BuildExecutorSchema {
  engine?: 'docker' | 'podman';
  quiet?: boolean;
  context?: string;
  file?: string;
  'add-hosts'?: string[];
  allow?: string[];
  'build-args'?: string[];
  'build-contexts'?: string[];
  builder?: string;
  'create-builder'?: boolean;
  'cache-from'?: string | string[];
  'cache-to'?: string | string[];
  'cgroup-parent'?: string;
  labels?: string[];
  load?: boolean;
  network?: string;
  'no-cache'?: boolean;
  'no-cache-filters'?: string[];
  outputs?: string[];
  platforms?: string[];
  provenance?: string;
  pull?: boolean;
  push?: boolean;
  sbom?: boolean;
  secrets?: string[];
  'secret-files'?: string[];
  'shm-size'?: string;
  ssh?: string[];
  tags?: string[];
  target?: string;
  ulimit?: string[];
  metadata?: ContainerMetadataSchema;
  env?: Record<string, string>;
  envFile?: string;
}
