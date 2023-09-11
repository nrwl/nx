import { ExecutorContext, joinPathFragments, readJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import { env as appendLocalEnv } from 'npm-run-path';
import { logTar } from './log-tar';
import { PublishExecutorSchema } from './schema';

const LARGE_BUFFER = 1024 * 1000000;

function processEnv(color: boolean) {
  const env = {
    ...process.env,
    ...appendLocalEnv(),
  };

  if (color) {
    env.FORCE_COLOR = `${color}`;
  }
  return env;
}

export default async function runExecutor(
  options: PublishExecutorSchema,
  context: ExecutorContext
) {
  const projectConfig =
    context.projectsConfigurations!.projects[context.projectName!]!;

  const packageRoot = joinPathFragments(
    context.root,
    options.packageRoot ?? projectConfig.root
  );

  const npmPublishCommandSegments = [`npm publish --json`];

  if (options.registry) {
    npmPublishCommandSegments.push(`--registry=${options.registry}`);
  }

  if (options.tag) {
    npmPublishCommandSegments.push(`--tag=${options.tag}`);
  }

  // Resolve values using the `npm config` command so that things like environment variables and `publishConfig`s are accounted for
  const registry =
    options.registry ?? execSync(`npm config get registry`).toString().trim();
  const tag = options.tag ?? execSync(`npm config get tag`).toString().trim();

  try {
    const output = execSync(npmPublishCommandSegments.join(' '), {
      maxBuffer: LARGE_BUFFER,
      env: processEnv(true),
      cwd: packageRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutData = JSON.parse(output.toString());
    logTar(stdoutData);

    console.log(`Published to ${registry} with tag "${tag}"`);

    return {
      success: true,
    };
  } catch (err) {
    try {
      const projectPackageJson = readJsonFile(
        joinPathFragments(packageRoot, 'package.json')
      );
      const name = projectPackageJson.name;
      const currentVersion = projectPackageJson.version;

      const stdoutData = JSON.parse(err.stdout?.toString() || '{}');
      if (stdoutData.error?.code === 'EPUBLISHCONFLICT') {
        // If package and project name match, make it terser
        let packageTxt =
          name === context.projectName
            ? `package "${name}"`
            : `package "${name}" from project "${context.projectName}"`;

        console.warn(
          `Skipping ${packageTxt}, as v${currentVersion} has already been published to ${registry} with tag "${tag}"`
        );
        return {
          success: true,
        };
      }

      console.error('npm publish error:');
      if (stdoutData.error.summary) {
        console.error(stdoutData.error.summary);
      }
      if (stdoutData.error.detail) {
        console.error(stdoutData.error.detail);
      }
      return {
        success: false,
      };
    } catch (err) {
      // npm v9 onwards seems to guarantee stdout will be well formed JSON when --json is used, so maybe we need to
      // specify that as minimum supported version? (comes with node 18 and 20 by default)
      console.error(
        'Something unexpected went wrong when processing the npm publish output\n',
        err
      );
      return {
        success: false,
      };
    }
  }
}
