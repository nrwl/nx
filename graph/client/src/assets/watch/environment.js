window.exclude = [];
window.watch = true;
window.environment = 'watch';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: false,
  showExperimentalFeatures: true,
  projects: [
    {
      id: 'local',
      label: 'local',
      projectGraphUrl: 'assets/project-graphs/e2e.json',
      taskGraphUrl: 'assets/task-graphs/e2e.json',
    },
  ],
  defaultProject: 'local',
};
