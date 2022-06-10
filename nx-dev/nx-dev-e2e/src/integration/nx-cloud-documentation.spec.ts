import { assertTextOnPage } from './helpers';

/**
 * Asserting all the additional API references pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
describe('nx-dev: Nx Cloud section', () => {
  (<{ title: string; path: string }[]>[
    { title: 'What is Nx Cloud?', path: '/nx-cloud/intro/what-is-nx-cloud' },
    {
      title: 'Set Up Distributed Caching',
      path: '/nx-cloud/set-up/set-up-caching',
    },
    {
      title: 'Set Up Distributed Task Execution',
      path: '/nx-cloud/set-up/set-up-dte',
    },
    {
      title: 'Record Non-Nx Commands',
      path: '/nx-cloud/set-up/record-commands',
    },
    {
      title: 'Enable GitHub PR Integration',
      path: '/nx-cloud/set-up/github',
    },
    {
      title: 'Billing and Utilization',
      path: '/nx-cloud/account/github',
    },
    {
      title: 'Users',
      path: '/nx-cloud/account/users',
    },
    {
      title: 'Authenticate with Google Identity',
      path: '/nx-cloud/account/google-auth',
    },
    {
      title: 'Access Tokens',
      path: '/nx-cloud/account/access-tokens',
    },
    {
      title: 'Security Scenarios',
      path: '/nx-cloud/account/scenarios',
    },
    {
      title: 'End to End Encryption',
      path: '/nx-cloud/account/encryption',
    },
    {
      title: 'Get Started',
      path: '/nx-cloud/private-cloud/get-started',
    },
    {
      title: 'Enable Github PR Integration',
      path: '/nx-cloud/private-cloud/github',
    },
    {
      title: 'Deploy with Kubernetes',
      path: '/nx-cloud/private-cloud/deploy-kubernetes',
    },
    {
      title: 'Deploy with AWS',
      path: '/nx-cloud/private-cloud/deploy-aws',
    },
    {
      title: 'Deploy with Azure',
      path: '/nx-cloud/private-cloud/deploy-azure',
    },
    {
      title: 'Authenticate with a Single Admin',
      path: '/nx-cloud/private-cloud/auth-single-admin',
    },
    {
      title: 'Authenticate with GitHub',
      path: '/nx-cloud/private-cloud/auth-github',
    },
    {
      title: 'Authenticate with GitLab',
      path: '/nx-cloud/private-cloud/auth-gitlab',
    },
    {
      title: 'Advanced Configuration',
      path: '/nx-cloud/private-cloud/advanced-config',
    },
    {
      title: 'Configuration Options',
      path: '/nx-cloud/reference/config',
    },
    {
      title: 'Environment Variables',
      path: '/nx-cloud/reference/env-vars',
    },
    {
      title: 'Server API Reference',
      path: '/nx-cloud/reference/server-api',
    },
    {
      title: 'Release Notes',
      path: '/nx-cloud/reference/release-notes',
    },
  ]).forEach((page) => assertTextOnPage(page.path, page.title));
});
