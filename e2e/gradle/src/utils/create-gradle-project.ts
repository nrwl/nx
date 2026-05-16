import {
  e2eConsoleLogger,
  isWindows,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { appendFileSync, createFileSync, writeFileSync } from 'fs-extra';
import { join, resolve } from 'path';

// Kotlin 2.2+ is required to target JVM 24 bytecode; older versions cap at
// JVM 23 and cause an inconsistent-JVM-target build failure on JDK 24.
const kotlinVersion = '2.3.21';

export function createGradleProject(
  projectName: string,
  type: 'kotlin' | 'groovy' = 'kotlin',
  cwd: string = tmpProjPath(),
  packageName: string = 'gradleProject',
  addProjectJsonNamePrefix: string = ''
) {
  // `java -version` prints to stderr, so redirect it to capture the output.
  const javaVersionOutput = execSync('java -version 2>&1').toString();
  e2eConsoleLogger(`Using java version: ${javaVersionOutput}`);
  const javaMajorVersion = parseJavaMajorVersion(javaVersionOutput);
  const gradleCommand = isWindows()
    ? resolve(`${__dirname}/../../../../gradlew.bat`)
    : resolve(`${__dirname}/../../../../gradlew`);
  e2eConsoleLogger(
    'Using gradle version: ' +
      execSync(`${gradleCommand} --version`, {
        cwd,
      })
  );
  // Run setup-time gradle commands with --no-daemon so we don't leave a
  // long-lived daemon holding inotify watches on the project dir. A daemon
  // spawned here outlives the setup phase and interferes with later
  // non-gradle filesystem operations (e.g. `nx import` runs `git
  // filter-branch --tree-filter`, which fails with "Unable to read current
  // working directory" when the daemon is concurrently watching the same
  // tree). The actual test-body gradle calls keep daemons enabled.
  e2eConsoleLogger(
    execSync(`${gradleCommand} help --task :init --no-daemon`, {
      cwd,
    }).toString()
  );
  e2eConsoleLogger(
    runCommand(
      // Pin the generated project's Java toolchain to the JDK that is
      // actually installed. Without this, `gradle init` defaults to a fixed
      // version (e.g. 21); if that differs from the installed JDK, Gradle
      // falls back to downloading it via the foojay API, which makes the
      // tests fail whenever foojay is unavailable.
      `${gradleCommand} init --type ${type}-application --dsl ${type} --project-name ${projectName} --package ${packageName} --java-version ${javaMajorVersion} --no-incubating --split-project --overwrite --no-daemon`,
      {
        cwd,
      }
    )
  );

  if (type === 'kotlin') {
    updateKotlinVersion(cwd, type);
    // The Kotlin Gradle Plugin writes session/IPC files under .kotlin/.
    // gradle init's template doesn't include it, so events for those
    // files leak through the daemon's watcher and cause recompute storms.
    appendToGitignore(cwd, '.kotlin/');
  }

  try {
    e2eConsoleLogger(
      runCommand(`${gradleCommand} clean --no-daemon`, {
        cwd,
      })
    );
  } catch (e) {}

  if (addProjectJsonNamePrefix) {
    createFileSync(join(cwd, 'app/project.json'));
    writeFileSync(
      join(cwd, 'app/project.json'),
      `{"name": "${addProjectJsonNamePrefix}app"}`
    );
    createFileSync(join(cwd, 'list/project.json'));
    writeFileSync(
      join(cwd, 'list/project.json'),
      `{"name": "${addProjectJsonNamePrefix}list"}`
    );
    createFileSync(join(cwd, 'utilities/project.json'));
    writeFileSync(
      join(cwd, 'utilities/project.json'),
      `{"name": "${addProjectJsonNamePrefix}utilities"}`
    );
  }

  addLocalPluginManagement(
    join(cwd, `settings.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );
  addLocalPluginManagement(
    join(cwd, `buildSrc/settings.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );

  addSpringBootPlugin(
    join(cwd, `app/build.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );
}

function parseJavaMajorVersion(javaVersionOutput: string): string {
  // Matches both modern (`24.0.2`) and legacy (`1.8.0_392`) version strings.
  const match = javaVersionOutput.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) {
    throw new Error(
      `Could not determine Java major version from: ${javaVersionOutput}`
    );
  }
  // Legacy versions report as `1.8` etc., where the real major is the second
  // segment; modern versions report the major directly.
  return match[1] === '1' && match[2] ? match[2] : match[1];
}

function appendToGitignore(cwd: string, entry: string) {
  const gitignorePath = join(cwd, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${entry}\n`);
    return;
  }
  const existing = readFileSync(gitignorePath, 'utf-8');
  if (existing.split('\n').some((line) => line.trim() === entry.trim())) {
    return;
  }
  appendFileSync(
    gitignorePath,
    existing.endsWith('\n') ? `${entry}\n` : `\n${entry}\n`
  );
}

function addLocalPluginManagement(filePath: string) {
  let content = readFileSync(filePath).toString();
  content =
    `pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
        mavenCentral()
        // Add other repositories if needed
    }
}
` + content;
  writeFileSync(filePath, content);
}

function updateKotlinVersion(cwd: string, type: 'kotlin' | 'groovy') {
  e2eConsoleLogger(`Updating Kotlin version to ${kotlinVersion}`);

  // Update the main build file
  const buildFilePath = join(
    cwd,
    `build.gradle${type === 'kotlin' ? '.kts' : ''}`
  );
  try {
    let buildContent = readFileSync(buildFilePath, 'utf-8');

    if (type === 'kotlin') {
      // Update Kotlin JVM plugin version in build.gradle.kts
      buildContent = buildContent.replace(
        /id\s*\(\s*["']org\.jetbrains\.kotlin\.jvm["']\s*\)\s+version\s+["'][^"']*["']/g,
        `id("org.jetbrains.kotlin.jvm") version "${kotlinVersion}"`
      );
    } else {
      // Update Kotlin JVM plugin version in build.gradle (Groovy)
      buildContent = buildContent.replace(
        /id\s+['"]org\.jetbrains\.kotlin\.jvm['"]\s+version\s+['"][^'"]*['"]/g,
        `id 'org.jetbrains.kotlin.jvm' version '${kotlinVersion}'`
      );
    }

    writeFileSync(buildFilePath, buildContent);
    e2eConsoleLogger(`Updated Kotlin version in ${buildFilePath}`);
  } catch (error) {
    e2eConsoleLogger(`Warning: Could not update ${buildFilePath}: ${error}`);
  }

  // Update subproject build files
  const subprojects = ['app', 'list', 'utilities'];
  subprojects.forEach((subproject) => {
    const subBuildFilePath = join(
      cwd,
      subproject,
      `build.gradle${type === 'kotlin' ? '.kts' : ''}`
    );
    try {
      let subBuildContent = readFileSync(subBuildFilePath, 'utf-8');

      if (type === 'kotlin') {
        // Update Kotlin JVM plugin version in subproject build.gradle.kts
        subBuildContent = subBuildContent.replace(
          /id\s*\(\s*["']org\.jetbrains\.kotlin\.jvm["']\s*\)/g,
          `id("org.jetbrains.kotlin.jvm") version "${kotlinVersion}"`
        );
      } else {
        // Update Kotlin JVM plugin version in subproject build.gradle (Groovy)
        subBuildContent = subBuildContent.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.jvm['"]/g,
          `id 'org.jetbrains.kotlin.jvm' version '${kotlinVersion}'`
        );
      }

      writeFileSync(subBuildFilePath, subBuildContent);
      e2eConsoleLogger(`Updated Kotlin version in ${subBuildFilePath}`);
    } catch (error) {
      e2eConsoleLogger(
        `Warning: Could not update ${subBuildFilePath}: ${error}`
      );
    }
  });

  // Create or update gradle/libs.versions.toml if it exists
  const versionCatalogPath = join(cwd, 'gradle', 'libs.versions.toml');
  try {
    let versionContent = readFileSync(versionCatalogPath, 'utf-8');
    // Update kotlin-gradle-plugin version in version catalog
    versionContent = versionContent.replace(
      /kotlin-gradle-plugin\s*=\s*["'][^"']*["']/g,
      `kotlin-gradle-plugin = "${kotlinVersion}"`
    );
    // Also update any plain kotlin version if it exists
    versionContent = versionContent.replace(
      /^kotlin\s*=\s*["'][^"']*["']/gm,
      `kotlin = "${kotlinVersion}"`
    );
    writeFileSync(versionCatalogPath, versionContent);
    e2eConsoleLogger(`Updated Kotlin version in ${versionCatalogPath}`);
  } catch (error) {
    // Version catalog might not exist, which is fine
    e2eConsoleLogger(
      `Version catalog not found at ${versionCatalogPath}, skipping`
    );
  }
}

function addSpringBootPlugin(filePath: string) {
  let content = readFileSync(filePath).toString();
  const isKotlin = filePath.endsWith('.kts');

  // Find the plugins block and add Spring Boot plugin
  if (content.includes('plugins {')) {
    const pluginLine = isKotlin
      ? '    id("org.springframework.boot") version "+"'
      : "    id 'org.springframework.boot' version '+'";

    content = content.replace(
      /plugins\s*\{/,
      `plugins {
${pluginLine}`
    );
  }

  writeFileSync(filePath, content);
}
