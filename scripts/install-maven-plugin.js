/*
Bootstrap the nx-maven-plugin into the local Maven repo (~/.m2) so @nx/maven's
graph inference can resolve it.

Only does real work when the pinned plugin version is NOT resolvable any other
way (i.e. an unpublished version under local development). For a published
version, Nx downloads it from Central on first use, so this skips.

Best-effort: never fails the install. Skips cleanly when Maven/Java is absent
or when maven is disabled.
*/

const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const os = require('os');

const PLUGIN = 'dev.nx.maven:nx-maven-plugin';

function disabled() {
  return (
    process.env.NX_MAVEN_DISABLE === 'true' ||
    process.env.SKIP_ANALYZER_BUILD === 'true' ||
    process.env.SKIP_NATIVE_TARGET === 'true'
  );
}

function readVersion() {
  const src = readFileSync(
    join(__dirname, '../packages/maven/src/utils/versions.ts'),
    'utf8'
  );
  return src.match(/mavenPluginVersion\s*=\s*'([^']+)'/)?.[1];
}

function inLocalRepo(version) {
  const m2 =
    process.env.MAVEN_REPO_LOCAL || join(os.homedir(), '.m2/repository');
  return existsSync(join(m2, 'dev/nx/maven/nx-maven-plugin', version));
}

async function onCentral(version) {
  const url = `https://repo1.maven.org/maven2/dev/nx/maven/nx-maven-plugin/${version}/nx-maven-plugin-${version}.pom`;
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

function hasToolchain() {
  if (!existsSync(join(__dirname, '../mvnw'))) return false;
  try {
    execSync('java -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (disabled()) return;

  const version = readVersion();
  if (!version) return;

  // Already resolvable — nothing to bootstrap.
  if (inLocalRepo(version)) return;
  if (await onCentral(version)) return;

  if (!hasToolchain()) {
    console.warn(
      `[maven] nx-maven-plugin ${version} is not published and Java/Maven was not found.\n` +
        `        Install it manually before running nx: ./mvnw install -pl ${PLUGIN} -am`
    );
    return;
  }

  console.log(
    `[maven] Bootstrapping unpublished nx-maven-plugin ${version} into ~/.m2 ...`
  );
  try {
    execSync(`./mvnw install -pl ${PLUGIN} -am`, {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch {
    console.warn(
      `[maven] Failed to install nx-maven-plugin ${version}. ` +
        `Run it manually: ./mvnw install -pl ${PLUGIN} -am`
    );
  }
}

main();
