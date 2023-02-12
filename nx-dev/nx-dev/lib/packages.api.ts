import { PackagesApi } from '@nrwl/nx-dev/data-access-packages/node-only';
import { ProcessedPackageMetadata } from '@nrwl/nx-dev/models-package';
import packages from '../public/documentation/generated/manifests/packages.json';
import { tagsApi } from './tags.api';

export const nxPackagesApi = new PackagesApi({
  id: 'packages',
  manifest: packages as Record<string, ProcessedPackageMetadata>,
  prefix: '',
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  tagsApi,
});
