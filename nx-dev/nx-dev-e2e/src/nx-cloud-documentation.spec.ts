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
    title: 'Security Scenarios',
    path: '/ci/concepts/scenarios',
  },
  {
    title: 'End to End Encryption',
    path: '/ci/concepts/encryption',
  },
  {
    title: 'Running Nx Cloud Enterprise',
    path: '/ci/private-cloud/get-started',
  },
  {
    title: 'Auth (Basic)',
    path: '/ci/private-cloud/auth-single-admin',
  },
  {
    title: 'GitHub Auth',
    path: '/ci/private-cloud/auth-github',
  },
  {
    title: 'GitLab Auth',
    path: '/ci/private-cloud/auth-gitlab',
  },
  {
    title: 'Setting up a dedicated NxCloud VM',
    path: '/ci/private-cloud/ami-setup',
  },
  {
    title: 'BitBucket Auth',
    path: '/ci/private-cloud/auth-bitbucket',
  },
  {
    title: 'SAML Auth',
    path: '/ci/private-cloud/auth-saml',
  },
  {
    title: 'Advanced Configuration',
    path: '/ci/private-cloud/advanced-config',
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
    title: 'Nx Cloud Server API Reference',
    path: '/ci/reference/server-api',
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
