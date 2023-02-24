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
      projectGraphUrl: 'project-graphs/e2e.json',
      taskGraphUrl: 'task-graphs/e2e.json',
    },
    {
      id: 'affected',
      label: 'affected',
      projectGraphUrl: 'project-graphs/affected.json',
      taskGraphUrl: 'task-graphs/affected.json',
    },
  ],
  defaultWorkspaceId: 'e2e',
};
