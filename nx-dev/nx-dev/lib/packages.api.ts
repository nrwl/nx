import { PackagesApi } from '@nx/nx-dev/data-access-packages/node-only';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import packages from '../public/documentation/generated/manifests/nx-api.json';
import { tagsApi } from './tags.api';

export const nxPackagesApi = new PackagesApi({
  id: 'nx-api',
  manifest: packages as Record<string, ProcessedPackageMetadata>,
  prefix: '',
  publicDocsRoot: 'public/documentation',
  tagsApi,
});
