import { logger } from 'nx/src/devkit-exports';
import { AggregatedLog } from './aggregate-log-util';

describe(`aggregateLog utils`, () => {
  it('should aggregate similar logs to single log listing the affected projects', () => {
    // ARRANGE
    let spyLog = '';
    jest.spyOn(logger, 'warn').mockImplementation((log) => (spyLog = log));
    const aggregatedLogs = new AggregatedLog();
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'app',
    });
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'myapp',
    });
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'shop-app',
    });

    // ACT
    aggregatedLogs.flushLogs();

    // ASSERT
    expect(logger.warn).toHaveBeenCalled();
    expect(spyLog).toMatchInlineSnapshot(`
      "[1mEncountered the following while migrating '@nx/vite:serve':[22m
      [1m[22m   • Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.
           [1mAffected Projects[22m
            app
            myapp
            shop-app
      "
    `);
  });

  it('should aggregate similar logs to single log and output different logs correctly', () => {
    // ARRANGE
    let spyLog = '';
    jest.spyOn(logger, 'warn').mockImplementation((log) => (spyLog = log));
    const aggregatedLogs = new AggregatedLog();
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'app',
    });
    aggregatedLogs.addLog({
      executorName: '@nx/vite:build',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'myapp',
    });
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
      project: 'shop-app',
    });
    aggregatedLogs.addLog({
      executorName: '@nx/vite:serve',
      log: `Encountered 'AnotherValue' in project.json. You will need to copy the contents of this file to the 'config.prop' property in your Vite config file.`,
      project: 'shop-app',
    });

    // ACT
    aggregatedLogs.flushLogs();

    // ASSERT
    expect(logger.warn).toHaveBeenCalled();
    expect(spyLog).toMatchInlineSnapshot(`
      "[1mEncountered the following while migrating '@nx/vite:serve':[22m
      [1m[22m   • Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.
           [1mAffected Projects[22m
            app
            shop-app
         • Encountered 'AnotherValue' in project.json. You will need to copy the contents of this file to the 'config.prop' property in your Vite config file.
           [1mAffected Projects[22m
            shop-app
      [1mEncountered the following while migrating '@nx/vite:build':[22m
      [1m[22m   • Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.
           [1mAffected Projects[22m
            myapp
      "
    `);
  });
});
