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
      `Skipped ${packageTxt}, because it has \`"private": true\` in ${packageJsonPath}`
    );
    return {
      success: true,
    };
  }

  const npmPublishCommandSegments = [`npm publish --json`];
  const npmViewCommandSegments = [
    `npm view ${packageName} versions dist-tags --json`,
  ];

  if (options.registry) {
    npmPublishCommandSegments.push(`--registry=${options.registry}`);
    npmViewCommandSegments.push(`--registry=${options.registry}`);
  }

  if (options.tag) {
    npmPublishCommandSegments.push(`--tag=${options.tag}`);
  }

  if (options.otp) {
    npmPublishCommandSegments.push(`--otp=${options.otp}`);
  }

  if (options.dryRun) {
    npmPublishCommandSegments.push(`--dry-run`);
  }

  // Resolve values using the `npm config` command so that things like environment variables and `publishConfig`s are accounted for
  const registry =
    options.registry ?? execSync(`npm config get registry`).toString().trim();
  const tag = options.tag ?? execSync(`npm config get tag`).toString().trim();
  const currentVersion = projectPackageJson.version;

  try {
    const result = execSync(npmViewCommandSegments.join(' '), {
      env: processEnv(true),
      cwd: packageRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const resultJson = JSON.parse(result.toString());
    const distTags = resultJson['dist-tags'] || {};
    if (distTags[tag] === currentVersion) {
      console.warn(
        `Skipped ${packageTxt} because v${currentVersion} already exists in ${registry} with tag "${tag}"`
      );
      return {
        success: true,
      };
    }

    if (resultJson.versions.includes(currentVersion)) {
      try {
        if (!options.dryRun) {
          execSync(
            `npm dist-tag add ${packageName}@${currentVersion} ${tag} --registry=${registry}`,
            {
              env: processEnv(true),
              cwd: packageRoot,
              stdio: 'ignore',
            }
          );
          console.log(
            `Added the dist-tag ${tag} to v${currentVersion} for registry ${registry}.\n`
          );
        } else {
          console.log(
            `Would add the dist-tag ${tag} to v${currentVersion} for registry ${registry}, but ${chalk.keyword(
              'orange'
            )('[dry-run]')} was set.\n`
          );
        }
        return {
          success: true,
        };
      } catch (err) {
        try {
          const stdoutData = JSON.parse(err.stdout?.toString() || '{}');

          console.error('npm dist-tag add error:');
          if (stdoutData.error.summary) {
            console.error(stdoutData.error.summary);
          }
          if (stdoutData.error.detail) {
            console.error(stdoutData.error.detail);
          }

          if (context.isVerbose) {
            console.error('npm dist-tag add stdout:');
            console.error(JSON.stringify(stdoutData, null, 2));
          }
          return {
            success: false,
          };
        } catch (err) {
          console.error(
            'Something unexpected went wrong when processing the npm dist-tag add output\n',
            err
          );
          return {
            success: false,
          };
        }
      }
    }
  } catch (err) {
    const stdoutData = JSON.parse(err.stdout?.toString() || '{}');
    // If the error is that the package doesn't exist, then we can ignore it because we will be publishing it for the first time in the next step
    if (
      !(
        stdoutData.error?.code?.includes('E404') &&
        stdoutData.error?.summary?.includes('no such package available')
      )
    ) {
      console.error(
        `Something unexpected went wrong when checking for existing dist-tags.\n`,
        err
      );
      return {
        success: false,
      };
    }
  }

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
      const stdoutData = JSON.parse(err.stdout?.toString() || '{}');

      console.error('npm publish error:');
      if (stdoutData.error.summary) {
        console.error(stdoutData.error.summary);
      }
      if (stdoutData.error.detail) {
        console.error(stdoutData.error.detail);
      }

      if (context.isVerbose) {
        console.error('npm publish stdout:');
        console.error(JSON.stringify(stdoutData, null, 2));
      }
      return {
        success: false,
      };
    } catch (err) {
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
