import { Config } from '@stryker-mutator/api/config';
import { LoggerApi } from "@angular-devkit/core/src/logger";
import { LogLevel } from '@stryker-mutator/api/core';
import { Schema as StrykerBuilderSchema } from './schema';

export class StrykerConfiguration{
  private readonly _config = new Config();

    constructor(private _logger: LoggerApi, private _workspaceRoot: string){}

    validateConfig(options:StrykerBuilderSchema){
      if(options.configFile){
        return this.getConfigurationByFile(options.configFile);
      }
      return this.getConfigByParams(options);
    }

    getConfigByParams(options:StrykerBuilderSchema){        
      this._logger.debug(`Starting stryker builder with params configuration`);
        const plugins = [...options.plugins, '@stryker-mutator/html-reporter'];
        switch (options.testPackage) {
          case "jest":
            plugins.push('@stryker-mutator/jest-runner');
            break;
          case "karma":
            plugins.push('@stryker-mutator/karma-runner');
            break;
        }
        this._config.set({
          mutator: options.mutator,
          packageManager: options.packageManager,
          testRunner: options.testRunner,
          commandRunner: options.commandRunner,
          plugins: plugins,
          coverageAnalysis: options.coverageAnalysis,
          tsconfigFile: options.tsconfigFile,
          files: options.files,
          mutate:  options.mutate,
          fileLogLevel: options.fileLogLevel || LogLevel.Off,
          logLevel: options.logLevel || LogLevel.Off,
          timeoutMS: options.timeoutMS,
          reporters: options.reporters || ['html']
          });
          this._logger.debug(`Stryker Config ${JSON.stringify(this._config)}`);
       return this._config;
    }

    getConfigurationByFile(configFilePath: string){
      this._logger.debug(`Starting stryker builder with file configuration ${configFilePath}`);
      const configFile = require(`${this._workspaceRoot}/${configFilePath}`);
      configFile(this._config);
      this._logger.debug(`Stryker Config ${JSON.stringify(this._config)}`);
      return this._config
    }
}
