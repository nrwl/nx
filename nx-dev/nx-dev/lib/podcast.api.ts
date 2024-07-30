import { blogApi } from './blog.api';
import { PodcastApi } from '@nx/nx-dev/data-access-documents/node-only';

export const podcastApi = new PodcastApi({ blogApi });
