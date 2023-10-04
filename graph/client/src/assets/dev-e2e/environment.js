window.exclude = [];
window.watch = false;
window.environment = 'dev';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: true,
  showExperimentalFeatures: true,
  workspaces: [
    {
      id: 'e2e',
      label: 'e2e',
      projectGraphUrl: 'assets/project-graphs/e2e.json',
      taskGraphUrl: 'assets/task-graphs/e2e.json',
    },
    {
      id: 'affected',
      label: 'affected',
      projectGraphUrl: 'assets/project-graphs/affected.json',
      taskGraphUrl: 'assets/task-graphs/affected.json',
    },
  ],
  defaultWorkspaceId: 'e2e',
};
