import { GitHubIntegrationTab } from './github-intergration-tab';
import { GraphTab } from './graph-tab';
import { PluginsTab } from './plugins-tab';
import { VscodeIntegrationTab } from './vscode-integration-tab';

export const tabs = [
  { title: 'VSCode support', panel: VscodeIntegrationTab },
  { title: 'Interactive graph', panel: GraphTab },
  { title: 'GitHub integration', panel: GitHubIntegrationTab },
  { title: 'Plugins', panel: PluginsTab },
];
