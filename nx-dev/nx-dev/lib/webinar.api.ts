import { blogApi } from './blog.api';
import { WebinarApi } from '@nx/nx-dev-data-access-documents/node-only';

export const webinarApi = new WebinarApi({ blogApi });
