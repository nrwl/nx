window.exclude = [];
window.watch = true;
window.environment = 'watch';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: false,
  showExperimentalFeatures: true,
  workspaces: [
    {
      id: 'local',
      label: 'local',
      projectGraphUrl: 'project-graphs/e2e.json',
      taskGraphUrl: 'task-graphs/e2e.json',
    },
  ],
  defaultWorkspaceId: 'local',
};
