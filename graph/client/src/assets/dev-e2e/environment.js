window.exclude = [];
window.watch = false;
window.environment = 'dev';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: true,
  showExperimentalFeatures: true,
  projectGraphs: [
    {
      id: 'e2e',
      label: 'e2e',
      url: 'assets/graphs/e2e.json',
    },
    {
      id: 'affected',
      label: 'affected',
      url: 'assets/graphs/affected.json',
    },
  ],
  defaultProjectGraph: 'e2e',
};
