import { assertTextOnPage } from './helpers';
import { test, expect } from '@playwright/test';

const pages: Array<{ title: string; path: string }> = [
  {
    title: 'Continuous Integration with Nx',
    path: '/ci/intro/ci-with-nx',
  },
  {
    title: 'Recording Non-Nx Commands',
    path: '/ci/recipes/other/record-commands',
  },
  {
    title: 'Enable GitHub PR Integration',
    path: '/ci/recipes/source-control-integration/github',
  },
  {
    title: 'Connecting Nx Cloud to your existing Google identity provider',
    path: '/ci/recipes/security/google-auth',
  },
  {
    title: 'Access Tokens',
    path: '/ci/recipes/security/access-tokens',
  },
  {
    title: 'Cache Security',
    path: '/ci/concepts/cache-security',
  },
  {
    title: 'Heartbeat and main job completion handling',
    path: '/ci/concepts/heartbeat',
  },
  {
    title: 'Enable End to End Encryption',
    path: '/ci/recipes/security/encryption',
  },
  {
    title: 'Configuring the Cloud Runner / Nx CLI',
    path: '/ci/reference/config',
  },
  {
    title: 'Environment Variables',
    path: '/ci/reference/env-vars',
  },
  {
    title: 'Enterprise Release Notes',
    path: '/ci/reference/release-notes',
  },
];

/**
 * Asserting all the additional API references pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
test.describe('nx-dev: Nx Cloud section', () => {
  pages.forEach((page) => assertTextOnPage(page.path, page.title));
});
