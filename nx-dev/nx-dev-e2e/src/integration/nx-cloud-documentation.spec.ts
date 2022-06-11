import { assertTextOnPage } from './helpers';

/**
 * Asserting all the additional API references pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
describe('nx-dev: Nx Cloud section', () => {
  (<{ title: string; path: string }[]>[
    { title: 'What is Nx Cloud?', path: '/nx-cloud/intro/what-is-nx-cloud' },
    {
      title: 'Adding Nx Cloud to an Nx Workspace',
      path: '/nx-cloud/set-up/set-up-caching',
    },
    {
      title: 'Set Up Distributed Task Execution',
      path: '/nx-cloud/set-up/set-up-dte',
    },
    {
      title: 'Recording Non-Nx Commands',
      path: '/nx-cloud/set-up/record-commands',
    },
    {
      title: 'Enable Github PR Integration',
      path: '/nx-cloud/set-up/github',
    },
    {
      title: 'Billing and Utilization',
      path: '/nx-cloud/account/billing',
    },
    {
      title: 'User Management',
      path: '/nx-cloud/account/users',
    },
    {
      title: 'Connecting Nx Cloud to your existing Google identity provider',
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
      title: 'Getting Started with Nx Private Cloud',
      path: '/nx-cloud/private-cloud/get-started',
    },
    {
      title: 'Private Cloud GitHub PR Integration',
      path: '/nx-cloud/private-cloud/github',
    },
    {
      title: 'Nx Private Cloud and Kubernetes',
      path: '/nx-cloud/private-cloud/deploy-kubernetes',
    },
    {
      title: 'Deploying Nx Private Cloud to AWS',
      path: '/nx-cloud/private-cloud/deploy-aws',
    },
    {
      title: 'Deploying Nx Private Cloud to Azure',
      path: '/nx-cloud/private-cloud/deploy-azure',
    },
    {
      title: 'Nx Private Cloud Auth',
      path: '/nx-cloud/private-cloud/auth-single-admin',
    },
    {
      title: 'Nx Private Cloud GitHub Auth',
      path: '/nx-cloud/private-cloud/auth-github',
    },
    {
      title: 'Nx Private Cloud GitLab Auth',
      path: '/nx-cloud/private-cloud/auth-gitlab',
    },
    {
      title: 'Advanced Configuration',
      path: '/nx-cloud/private-cloud/advanced-config',
    },
    {
      title: 'Configuring the Cloud Runner / Nx CLI',
      path: '/nx-cloud/reference/config',
    },
    {
      title: 'Environment Variables',
      path: '/nx-cloud/reference/env-vars',
    },
    {
      title: 'Nx Cloud Server API Reference',
      path: '/nx-cloud/reference/server-api',
    },
    {
      title: '@nrwl/nx-cloudNx Private Cloud',
      path: '/nx-cloud/reference/release-notes',
    },
  ]).forEach((page) => assertTextOnPage(page.path, page.title));
});
