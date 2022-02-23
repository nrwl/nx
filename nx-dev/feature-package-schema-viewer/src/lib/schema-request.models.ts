import { PackageMetadata } from '@nrwl/nx-dev/models-package';

export interface SchemaRequest {
  pkg: PackageMetadata;
  type: 'executors' | 'generators';
  schemaName: string;
}
