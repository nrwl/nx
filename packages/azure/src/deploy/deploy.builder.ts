import { Builder, BuilderConfiguration, BuilderContext, BuildEvent } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { concatMap, first, tap } from 'rxjs/operators';
import { BuildNodeBuilderOptions, NodeBuildEvent } from '../../../builders/src/node/build/node-build.builder';
import { dirSync } from 'tmp';
import { execSync } from 'child_process';
import { basename, join } from 'path';
import { readdirSync } from 'fs';

export interface DeployArgs {
  buildTarget: string;
  azureWebAppName: string;
  create: boolean;
  deployment: {
    type: 'git' | 'zip',
    remote: string
  }
}

export default class DeployBuilder implements Builder<DeployArgs> {

  constructor(private context: BuilderContext) {
  }

  run(
    builderConfig: BuilderConfiguration<DeployArgs>
  ): Observable<BuildEvent> {
    const [project, target, configuration] = builderConfig.options.buildTarget.split(':');

    const buildBuilderConfig = this.context.architect.getBuilderConfiguration<BuildNodeBuilderOptions>({
      project,
      target,
      configuration,
      overrides: {
        watch: true
      }
    });

    return this.context.architect.getBuilderDescription(buildBuilderConfig).pipe(
      concatMap(buildDescription =>
        this.context.architect.validateBuilderOptions(
          buildBuilderConfig,
          buildDescription
        )
      ),
      concatMap(
        builderConfig =>
          this.context.architect.run(builderConfig, this.context) as Observable<NodeBuildEvent>
      ),
      first(),
      tap(r => {
        if (r.success) {
          if (builderConfig.options.create) {
            this.createApp(builderConfig);
          }

          console.log('Deploying to Azure...');

          const tmp = dirSync().name;

          const projectFolder = basename(buildBuilderConfig.options.outputPath);
          execSync(`cp -r ${buildBuilderConfig.options.outputPath} ${tmp}`);
          const dir = readdirSync(join(buildBuilderConfig.sourceRoot, 'azure'))[0];
          execSync(`cp -r ${join(buildBuilderConfig.sourceRoot, 'azure', dir)}/*.* ${join(tmp, projectFolder)}`);

          const tmpWithProject = join(tmp, projectFolder);
          execSync(`git init`, { cwd: tmpWithProject });
          execSync(`git add .`, { cwd: tmpWithProject });
          execSync(`git commit -am 'init'`, { cwd: tmpWithProject });
          execSync(`git remote add azure ${builderConfig.options.deployment.remote}`, { cwd: tmpWithProject });
          execSync(`git push --force azure master`, { cwd: tmpWithProject, stdio: [0, 1, 2] });

          const apps = JSON.parse(execSync(`az webapp list`).toString());
          const app = apps.find(f => f.name === builderConfig.options.azureWebAppName);
          const h = app.hostNames[0];

          console.log(`You can access the deployed app at: https://${h}`);
        }
      })
    );
  }

  private createApp(builderConfig: BuilderConfiguration<DeployArgs>) {
    const resource = JSON.parse(execSync(`az resource list`).toString())[0];
    const plan = resource.name;
    const resourceGroup = resource.resourceGroup;
    const runtime = `node|10.6`;

    console.log('Creating a new webapp on Azure');
    execSync(`az webapp create --name=${builderConfig.options.azureWebAppName} --plan=${plan} --resource-group=${resourceGroup} --runtime='${runtime}' --deployment-local-git`, { stdio: [0, 1, 2] });

    console.log('Successfully create a new app on Azure');
  }
}
