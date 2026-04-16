/**
 * Creates a versioned docs branch containing only the pre-built static site.
 *
 * Usage:
 *   node ./scripts/create-versioned-docs.mts v22
 *   node ./scripts/create-versioned-docs.mts 22
 *
 * What it does:
 *   1. Fetches tags from origin, finds the latest stable release for that major
 *   2. Checks out that tag, builds the docs site
 *   3. Creates an orphan branch `v{major}` with ONLY the pre-built static site
 *      plus minimal scaffolding so Netlify can "build" (no-op)
 *   4. Returns to the original branch
 *
 * For v21+: builds astro-docs (Astro/Starlight)
 * For v18-v20: builds nx-dev (Next.js with static export)
 *
 * The Netlify nx-dev app UI expects:
 *   - Build command: npx nx run nx-dev:deploy-build:netlify --skip-nx-cache
 *   - Publish dir: ./nx-dev/nx-dev/.next
 *
 * The versioned branch keeps that layout (project named "nx-dev" at
 * nx-dev/nx-dev/, static files at nx-dev/nx-dev/.next/) but uses a root
 * netlify.toml to override the build command to a no-op and — critically —
 * NOT include @netlify/plugin-nextjs, so Netlify serves pure static files.
 *
 * The resulting branch is deployed via Netlify branch deploys at v{major}.nx.dev.
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// TODO: Remove FIRST_ASTRO_MAJOR and buildAndStageNextjs() once v21+ are the
// only versioned websites we maintain. At that point, delete the entire legacy
// function and the branching logic that calls it.
const FIRST_ASTRO_MAJOR = 21;

// Disable non-JS plugins that require external toolchains (Java, .NET)
process.env.NX_GRADLE_DISABLE = 'true';
process.env.NX_MAVEN_DISABLE = 'true';
process.env.NX_DOTNET_DISABLE = 'true';

// Must match the Netlify UI publish directory setting
const PUBLISH_DIR = 'nx-dev/nx-dev/.next';

// When useMise is true, commands are wrapped with `mise exec --` so they
// use the Node version from .mise.toml (needed for legacy Next.js builds).
let useMise = false;

function run(cmd: string, opts?: { cwd?: string }) {
  const fullCmd = useMise ? `mise exec -- ${cmd}` : cmd;
  console.log(`$ ${fullCmd}`);
  execSync(fullCmd, { stdio: 'inherit', cwd: opts?.cwd ?? ROOT });
}

function parseVersion(input: string): string {
  const match = input.replace(/^v/i, '');
  if (!/^\d+$/.test(match)) {
    console.error(
      `Invalid version: "${input}". Expected a major version like "22" or "v22".`
    );
    process.exit(1);
  }
  return match;
}

function findLatestStableTag(major: string): string | null {
  const tags = execSync(`git tag -l '${major}.*'`, { cwd: ROOT })
    .toString()
    .trim()
    .split('\n')
    .filter((t) => t && !t.includes('-'));

  if (tags.length === 0) return null;

  tags.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return tags[tags.length - 1];
}

/**
 * Write the shared scaffolding every versioned branch needs.
 * Writes headers/redirects netlify.toml content to the publish dir.
 */
function writeSharedScaffolding(
  tmpDir: string,
  headersAndRedirects: string
): void {
  const rootPkg = JSON.parse(
    readFileSync(resolve(ROOT, 'package.json'), 'utf-8')
  );
  const nxVersion =
    rootPkg.devDependencies?.nx ?? rootPkg.dependencies?.nx ?? 'latest';

  // Root package.json with nx so Netlify install succeeds
  writeFileSync(
    resolve(tmpDir, 'package.json'),
    JSON.stringify(
      {
        name: '@nx/nx-docs-versioned',
        version: '0.0.1',
        private: true,
        devDependencies: { nx: nxVersion },
      },
      null,
      2
    ) + '\n'
  );

  writeFileSync(resolve(tmpDir, 'nx.json'), JSON.stringify({}, null, 2) + '\n');

  // Generate a real pnpm-lock.yaml from the stub package.json.
  // Must use --no-frozen-lockfile since there's no existing lockfile yet.
  console.log('Generating pnpm-lock.yaml for versioned branch...');
  execSync('pnpm install --lockfile-only --no-frozen-lockfile', {
    cwd: tmpDir,
    stdio: 'inherit',
  });

  // Project named "nx-dev" at nx-dev/nx-dev/ to match the Netlify build command:
  // npx nx run nx-dev:deploy-build:netlify --skip-nx-cache
  mkdirSync(resolve(tmpDir, 'nx-dev/nx-dev'), { recursive: true });
  writeFileSync(
    resolve(tmpDir, 'nx-dev/nx-dev/project.json'),
    JSON.stringify(
      {
        name: 'nx-dev',
        targets: {
          'deploy-build': {
            command: "echo 'Pre-built static site'",
            configurations: {
              netlify: {},
            },
          },
        },
      },
      null,
      2
    ) + '\n'
  );

  // Root netlify.toml overrides UI settings for this branch.
  // NETLIFY_NEXT_PLUGIN_SKIP disables the auto-installed @netlify/plugin-nextjs
  // so Netlify serves the publish dir as pure static files.
  writeFileSync(
    resolve(tmpDir, 'netlify.toml'),
    `# Auto-generated for versioned docs branch — overrides Netlify UI settings.
# NETLIFY_NEXT_PLUGIN_SKIP disables @netlify/plugin-nextjs = pure static serving.

[build]
  command = "npx nx run nx-dev:deploy-build:netlify --skip-nx-cache"
  publish = "${PUBLISH_DIR}"

[build.environment]
  NETLIFY_NEXT_PLUGIN_SKIP = "true"

${headersAndRedirects}`
  );
}

// ---------------------------------------------------------------------------
// Build + stage: Astro (v21+)
// ---------------------------------------------------------------------------
function buildAndStageAstro(tmpDir: string): void {
  run(`pnpm nx build astro-docs --force`);

  const distDir = resolve(ROOT, 'astro-docs/dist');
  if (!existsSync(distDir)) {
    console.error('Build failed: astro-docs/dist not found');
    process.exit(1);
  }

  cpSync(distDir, resolve(tmpDir, PUBLISH_DIR), { recursive: true });

  // Read the existing astro-docs/netlify.toml for headers/redirects
  const tomlContent = readFileSync(
    resolve(ROOT, 'astro-docs/netlify.toml'),
    'utf-8'
  );
  // Strip any [build] section from it — we provide our own
  const headersAndRedirects = tomlContent
    .replace(/\[build\.environment\][\s\S]*?(?=\n\[|\n#|\n\[\[|$)/g, '')
    .replace(/\[build\][\s\S]*?(?=\n\[|\n#|\n\[\[|$)/g, '')
    .trim();

  writeSharedScaffolding(tmpDir, headersAndRedirects);
}

// ---------------------------------------------------------------------------
// Build + stage: Next.js (v18-v20)
// TODO: Remove this entire function once v21+ are the only maintained versions.
// ---------------------------------------------------------------------------
function buildAndStageNextjs(tmpDir: string): void {
  // Patch next.config.js to enable static export
  const nextConfigPath = resolve(ROOT, 'nx-dev/nx-dev/next.config.js');
  let nextConfig = readFileSync(nextConfigPath, 'utf-8');

  if (!nextConfig.includes("output: 'export'")) {
    nextConfig = nextConfig.replace(
      /module\.exports\s*=\s*withNx\(\{/,
      "module.exports = withNx({\n  output: 'export',\n  images: { unoptimized: true },"
    );
    writeFileSync(nextConfigPath, nextConfig);
  }

  // Remove pages that can't be statically exported (dirs or .tsx files)
  const pagesDir = resolve(ROOT, 'nx-dev/nx-dev/pages');
  for (const page of ['ai-chat', 'api', 'plugin-registry']) {
    for (const candidate of [
      resolve(pagesDir, page),
      resolve(pagesDir, `${page}.tsx`),
    ]) {
      if (existsSync(candidate)) {
        console.log(
          `Removing non-static page: ${candidate.split('nx-dev/nx-dev/')[1]}`
        );
        rmSync(candidate, { recursive: true });
      }
    }
  }

  // Older Nx versions didn't use pnpm workspaces. Force hoisted node_modules
  // so all deps (e.g. @heroicons/react) are resolvable from nested nx-dev libs.
  writeFileSync(resolve(ROOT, '.npmrc'), 'node-linker=hoisted\n');
  run('pnpm install --no-frozen-lockfile');

  // Run build-base (actual Next.js build) directly — skip sitemap and
  // link-checker which fail with static export.
  run(`pnpm nx run nx-dev:build-base --force`);

  // @nx/next:build puts the Next.js build cache at dist/nx-dev/nx-dev/
  // and the static export (from output:'export') at dist/nx-dev/nx-dev/.next/
  // We want the static export HTML, not the build cache.
  const exportDir = resolve(ROOT, 'dist/nx-dev/nx-dev/.next');
  if (!existsSync(exportDir)) {
    console.error('Build failed: dist/nx-dev/nx-dev/.next not found');
    process.exit(1);
  }

  cpSync(exportDir, resolve(tmpDir, PUBLISH_DIR), {
    recursive: true,
    filter: (src) => !src.includes('/cache/') && !src.endsWith('/project.json'),
  });

  const headersAndRedirects = `[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    Content-Security-Policy = "frame-ancestors 'none'"

[[redirects]]
  from = "/docs"
  to = "/getting-started/intro"

[[redirects]]
  from = "/"
  to = "/getting-started/intro"`;

  writeSharedScaffolding(tmpDir, headersAndRedirects);
}

// ===========================================================================
// Main
// ===========================================================================

const positionalArgs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('-')));
const force = flags.has('--force');

if (positionalArgs.length === 0) {
  console.error(
    'Usage: node ./scripts/create-versioned-docs.mts <version> [--force]'
  );
  console.error('  e.g. node ./scripts/create-versioned-docs.mts v22');
  process.exit(1);
}

// Fail fast if working tree is dirty
const status = execSync('git status --porcelain', { cwd: ROOT })
  .toString()
  .trim();
if (status) {
  console.error(
    'Working tree is dirty. Commit or stash changes before running this script.\n'
  );
  console.error(status);
  process.exit(1);
}

const majorVersion = parseVersion(positionalArgs[0]);
const majorNum = Number(majorVersion);
const branchName = majorVersion;
const isAstro = majorNum >= FIRST_ASTRO_MAJOR;

// Check if branch already exists (locally or on origin)
const branchExists =
  execSync(`git branch --list ${branchName}`, { cwd: ROOT })
    .toString()
    .trim() !== '' ||
  execSync(`git ls-remote --heads origin ${branchName}`, { cwd: ROOT })
    .toString()
    .trim() !== '';

if (branchExists && !force) {
  console.error(
    `Branch "${branchName}" already exists. Use --force to overwrite.\n` +
      `  node ./scripts/create-versioned-docs.mts ${positionalArgs[0]} --force`
  );
  process.exit(1);
}

console.log(`\nCreating versioned docs branch: ${branchName}`);
console.log(
  `Site type: ${isAstro ? 'Astro (v21+)' : 'Next.js (legacy v18-v20)'}\n`
);

// Save current ref to return to later
const currentRef = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT })
  .toString()
  .trim();

// --- Step 0: Find and checkout the latest stable tag ---
console.log('=== Step 0: Finding latest stable release tag ===\n');
run('git fetch --tags --force origin');

const latestTag = findLatestStableTag(majorVersion);
let sourceRef: string;

if (latestTag) {
  sourceRef = latestTag;
  console.log(`Found latest stable tag: ${sourceRef}`);
  run(`git checkout ${sourceRef}`);
} else {
  sourceRef = currentRef;
  console.log(
    `No stable tags found for major version ${majorVersion}. Using current branch: ${currentRef}`
  );
}

// --- Resolve GITHUB_TOKEN (needed for GitHub stars in docs build) ---
if (!process.env.GITHUB_TOKEN) {
  try {
    const token = execSync(
      "op read --account tuskteam 'op://Employee/API Keys/github_token'",
      {
        cwd: ROOT,
      }
    )
      .toString()
      .trim();
    if (token) {
      process.env.GITHUB_TOKEN = token;
      console.log('GITHUB_TOKEN resolved from 1Password.\n');
    }
  } catch {
    console.warn(
      'Could not resolve GITHUB_TOKEN from 1Password.\n' +
        'Re-run with: GITHUB_TOKEN="$(op read --account tuskteam \'op://Employee/API Keys/github_token\')" node ./scripts/create-versioned-docs.mts ...\n'
    );
  }
}

// --- Step 1: Install + build ---
console.log('\n=== Step 1: Building docs site ===\n');

// Legacy Next.js builds need Node 20 — pin via mise so child processes use it
if (!isAstro) {
  console.log('Pinning Node 20 via mise for legacy build...');
  run('mise use node@20');
  useMise = true;
}

// Remove node_modules to avoid stale deps from a different version/branch
const nodeModulesDir = resolve(ROOT, 'node_modules');
if (existsSync(nodeModulesDir)) {
  console.log('Removing node_modules for clean install...');
  rmSync(nodeModulesDir, { recursive: true });
}

run('pnpm install --frozen-lockfile');

const tmpDir = resolve(ROOT, 'tmp/versioned-docs');
if (existsSync(tmpDir)) {
  rmSync(tmpDir, { recursive: true });
}
mkdirSync(tmpDir, { recursive: true });

if (isAstro) {
  buildAndStageAstro(tmpDir);
} else {
  buildAndStageNextjs(tmpDir);
}

// --- Step 2: Create orphan branch ---
console.log('\n=== Step 2: Creating orphan branch ===\n');

try {
  run(`git checkout --orphan ${branchName}-tmp`);
  run('git rm -rf .');

  // Copy staged files into the working tree
  cpSync(resolve(tmpDir, 'package.json'), resolve(ROOT, 'package.json'));
  cpSync(resolve(tmpDir, 'nx.json'), resolve(ROOT, 'nx.json'));
  cpSync(resolve(tmpDir, 'pnpm-lock.yaml'), resolve(ROOT, 'pnpm-lock.yaml'));
  cpSync(resolve(tmpDir, 'netlify.toml'), resolve(ROOT, 'netlify.toml'));
  cpSync(resolve(tmpDir, 'nx-dev'), resolve(ROOT, 'nx-dev'), {
    recursive: true,
  });

  run('git add package.json nx.json pnpm-lock.yaml netlify.toml nx-dev/');
  run(
    `git commit -m "docs: versioned docs snapshot for ${branchName} (from ${sourceRef})"`
  );

  run(`git branch -M ${branchName}`);

  console.log(`\nBranch "${branchName}" created successfully.`);
  console.log(`\nTo push: git push -f origin ${branchName}`);
} finally {
  useMise = false; // git commands don't need mise wrapping
  console.log(`\nReturning to: ${currentRef}`);
  // Clean untracked files left by orphan branch before switching back
  run('git clean -fd');
  run(`git checkout ${currentRef}`);
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log('\nDone!');
