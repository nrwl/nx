window.exclude = [];
window.watch = false;
window.environment = 'nx-console';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: false,
  showExperimentalFeatures: false,
  workspaces: [
    {
      id: 'local',
      label: 'local',
      projectGraphUrl: 'assets/project-graphs/e2e.json',
      taskGraphUrl: 'assets/task-graphs/e2e.json',
    },
  ],
  defaultWorkspaceId: 'local',
};
