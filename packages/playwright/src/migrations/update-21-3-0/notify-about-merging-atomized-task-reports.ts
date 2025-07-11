export default function () {
  return [
    'The Playwright atomized tasks reports will now be merged by default in the "e2e-ci" target. ' +
      'As part of this change, each atomized task will no longer produce the report for the reporter(s) ' +
      'configured in the "playwright.config.ts" file but instead produce a blob report that will be ' +
      'used by the "e2e-ci" task to produce the final report. If you have a custom setup that relies ' +
      'on the atomized tasks reports and you want to keep the same behavior, you can set ' +
      '"mergeOutputs: false" for the "@nx/playwright/plugin" configuration in the "nx.json" file.',
  ];
}
