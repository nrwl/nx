import { ExecutorContext, joinPathFragments, readJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import { env as appendLocalEnv } from 'npm-run-path';
import { logTar } from './log-tar';
import { PublishExecutorSchema } from './schema';
import chalk = require('chalk');

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

  const packageJsonPath = joinPathFragments(packageRoot, 'package.json');
  const projectPackageJson = readJsonFile(packageJsonPath);
  const packageName = projectPackageJson.name;

  // If package and project name match, we can make log messages terser
  let packageTxt =
    packageName === context.projectName
      ? `package "${packageName}"`
      : `package "${packageName}" from project "${context.projectName}"`;

  if (projectPackageJson.private === true) {
    console.warn(
      `Skipping ${packageTxt}, because it has \`"private": true\` in ${packageJsonPath}`
    );
    return {
      success: true,
    };
  }

  const npmPublishCommandSegments = [`npm publish --json`];

  if (options.registry) {
    npmPublishCommandSegments.push(`--registry=${options.registry}`);
  }

  if (options.tag) {
    npmPublishCommandSegments.push(`--tag=${options.tag}`);
  }

  if (options.dryRun) {
    npmPublishCommandSegments.push(`--dry-run`);
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

    // If npm workspaces are in use, the publish output will nest the data under the package name, so we normalize it first
    const normalizedStdoutData = stdoutData[packageName] ?? stdoutData;
    logTar(normalizedStdoutData);

    if (options.dryRun) {
      console.log(
        `Would publish to ${registry} with tag "${tag}", but ${chalk.keyword(
          'orange'
        )('[dry-run]')} was set`
      );
    } else {
      console.log(`Published to ${registry} with tag "${tag}"`);
    }

    return {
      success: true,
    };
  } catch (err) {
    try {
      const currentVersion = projectPackageJson.version;

      const stdoutData = JSON.parse(err.stdout?.toString() || '{}');
      if (
        stdoutData.error?.code === 'EPUBLISHCONFLICT' ||
        (stdoutData.error?.code === 'E403' &&
          stdoutData.error?.body?.error?.includes(
            'You cannot publish over the previously published versions'
          ))
      ) {
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
