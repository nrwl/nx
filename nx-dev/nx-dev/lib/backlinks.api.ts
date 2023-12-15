import { BacklinksApi } from '@nx/nx-dev/data-access-documents/node-only';
import backlinks from '../public/documentation/generated/manifests/backlinks.json';

export const backlinksApi = new BacklinksApi(backlinks);
