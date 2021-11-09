window.exclude = [];
window.focusedProject = null;
window.groupByFolder = false;
window.watch = false;
window.environment = 'dev';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: true,
  projectGraphs: [
    {
      id: 'nx',
      label: 'Nx',
      url: 'assets/graphs/nx.json',
    },
    {
      id: 'ocean',
      label: 'Ocean',
      url: 'assets/graphs/ocean.json',
    },
    {
      id: 'nx-examples',
      label: 'Nx Examples',
      url: 'assets/graphs/nx-examples.json',
    },
    {
      id: 'sub-apps',
      label: 'Sub Apps',
      url: 'assets/graphs/sub-apps.json',
    },
    {
      id: 'storybook',
      label: 'Storybook',
      url: 'assets/graphs/storybook.json',
    },
  ],
  defaultProjectGraph: 'nx',
};
