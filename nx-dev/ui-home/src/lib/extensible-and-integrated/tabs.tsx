import { GitHubIntegrationTab } from './github-intergration-tab';
import { GraphTab } from './graph-tab';
import { PluginsTab } from './plugins-tab';
import { IdeIntegrationTab } from './ide-integration-tab';

export const tabs = [
  { title: 'IDE integrations', panel: IdeIntegrationTab },
  { title: 'Interactive graph', panel: GraphTab },
  { title: 'GitHub integration', panel: GitHubIntegrationTab },
  { title: 'Plugins', panel: PluginsTab },
];
