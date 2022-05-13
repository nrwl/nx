import { assertTextOnPage } from './helpers';

/**
 * Asserting all the additional API references pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
describe('nx-dev: Additional API references section', () => {
  (<{ title: string; path: string }[]>[
    { title: 'create-nx-workspace', path: '/cli/create-nx-workspace' },
    { title: 'generate', path: '/cli/generate' },
    { title: 'run', path: '/cli/run' },
    { title: 'daemon', path: '/cli/daemon' },
    { title: 'graph', path: '/cli/dep-graph' },
    { title: 'run-many', path: '/cli/run-many' },
    { title: 'affected', path: '/cli/affected' },
    { title: 'affected:graph', path: '/cli/affected-dep-graph' },
    { title: 'affected:apps', path: '/cli/affected-apps' },
    { title: 'affected:libs', path: '/cli/affected-libs' },
    { title: 'print-affected', path: '/cli/print-affected' },
    { title: 'format:check', path: '/cli/format-check' },
    { title: 'format:write', path: '/cli/format-write' },
    { title: 'migrate', path: '/cli/migrate' },
    { title: 'report', path: '/cli/report' },
    { title: 'list', path: '/cli/list' },
    { title: 'workspace-lint', path: '/cli/workspace-lint' },
    { title: 'workspace-generator', path: '/cli/workspace-generator' },
    { title: 'connect-to-nx-cloud', path: '/cli/connect-to-nx-cloud' },
    { title: 'reset', path: '/cli/reset' },
    { title: 'Storybook', path: '/storybook/overview-react' },
    { title: 'Storybook', path: '/storybook/overview-angular' },
    {
      title: 'Nrwl React Storybook Preset',
      path: '/storybook/migrate-webpack-final-react',
    },
    {
      title: 'Storybook Webpack Migration',
      path: '/storybook/migrate-webpack-final-angular',
    },
    {
      title: 'Upgrading to Storybook 6 (and Nx versions >10.1.x and <14.0.0)',
      path: '/storybook/upgrade-storybook-v6-react',
    },
    {
      title: 'Upgrading to Storybook 6 (and Nx versions >10.1.x and <14.0.0)',
      path: '/storybook/upgrade-storybook-v6-angular',
    },
    {
      title: 'Setting up Storybook Composition with Nx',
      path: '/storybook/storybook-composition-setup',
    },
    {
      title: 'Module: index',
      path: '/devkit/index',
    },
    {
      title: 'Module: ngcli-adapter',
      path: '/devkit/ngcli_adapter',
    },
  ]).forEach((page) => assertTextOnPage(page.path, page.title));
});
