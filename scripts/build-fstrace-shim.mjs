// Builds the file-read tracer for this host's platform into packages/nx/src/native.
// `--target=<rust triple>` is forwarded from build-native and selects the Linux target.
//
// macOS: one dylib with every slice a traced process tree can need, because an inserted
// library dyld cannot load kills the process. arm64 for native programs, arm64e for
// re-signed copies of Apple's binaries, x86_64 for Intel Macs and Rosetta.
// Linux: the LD_PRELOAD shim for the requested target.
// Windows: the DLL and its launcher for arm64, x64 and x86, because a traced process can
// start a child of any of them and injecting it needs that architecture's build.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nativeDir = join(root, 'packages/nx/src/native');
const sources = join(nativeDir, 'fstrace');
const target = process.argv
  .find((a) => a.startsWith('--target='))
  ?.slice('--target='.length);

function buildMacos() {
  // The publish workflow sets CC and an explicit sysroot after removing the Command Line
  // Tools SDKs, so both come from the environment when present.
  const cc =
    process.env.CC ||
    execFileSync('xcrun', ['-f', 'clang'], { encoding: 'utf8' }).trim();
  const sysroot = execFileSync(
    'xcrun',
    ['--sdk', 'macosx', '--show-sdk-path'],
    { encoding: 'utf8' }
  ).trim();
  execFileSync(
    cc,
    [
      '-O2',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-isysroot',
      sysroot,
      '-mmacosx-version-min=11.0',
      ...['arm64', 'arm64e', 'x86_64'].flatMap((a) => ['-arch', a]),
      '-dynamiclib',
      '-o',
      join(nativeDir, 'fstrace.darwin.dylib'),
      join(sources, 'macos.c'),
    ],
    { stdio: 'inherit' }
  );
}

function buildLinux() {
  // The artifact path comes from cargo, because .cargo/config.toml and CARGO_TARGET_DIR
  // both move the target directory.
  const out = execFileSync(
    'cargo',
    [
      'build',
      '--release',
      '-p',
      'nx-fstrace-shim',
      '--message-format=json-render-diagnostics',
      ...(target ? ['--target', target] : []),
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const so = out
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (m) => m.reason === 'compiler-artifact' && m.target?.name === 'fstrace'
    )
    .flatMap((m) => m.filenames)
    .find((f) => f.endsWith('.so'));
  if (!so) {
    throw new Error('cargo did not report the fstrace shim library');
  }
  copyFileSync(so, join(nativeDir, 'fstrace.linux.so'));
}

function buildWindows() {
  const vswhere = join(
    process.env['ProgramFiles(x86)'],
    'Microsoft Visual Studio/Installer/vswhere.exe'
  );
  const vs = execFileSync(
    vswhere,
    ['-latest', '-products', '*', '-property', 'installationPath'],
    { encoding: 'utf8' }
  ).trim();
  const vcvarsall = join(vs, 'VC/Auxiliary/Build/vcvarsall.bat');
  const host = process.arch === 'arm64' ? 'arm64' : 'x64';
  const toolsets = {
    arm64: host === 'arm64' ? 'arm64' : 'x64_arm64',
    x64: host === 'x64' ? 'x64' : 'arm64_amd64',
    x86: `${host === 'x64' ? 'x64' : 'arm64'}_x86`,
  };
  const work = mkdtempSync(join(tmpdir(), 'fstrace-build-'));
  try {
    for (const [arch, toolset] of Object.entries(toolsets)) {
      const obj = join(work, arch);
      const cl = (src, ...link) =>
        `cl /nologo /O2 /MT /W3 /WX /Fo:"${obj}\\${src}.obj" "${join(sources, 'windows', `${src}.c`)}" ${link.join(' ')} || exit /b 1`;
      const script = join(work, `${arch}.cmd`);
      writeFileSync(
        script,
        [
          `@call "${vcvarsall}" ${toolset} >nul || exit /b 1`,
          `@mkdir "${obj}"`,
          cl(
            'fstrace',
            '/LD',
            `/link /OUT:"${join(nativeDir, `fstrace-${arch}.dll`)}" /IMPLIB:"${obj}\\fstrace.lib"`
          ),
          cl(
            'tracer',
            `/link /OUT:"${join(nativeDir, `fstrace-${arch}.exe`)}"`
          ),
        ].join('\r\n')
      );
      execFileSync('cmd.exe', ['/d', '/c', script], {
        cwd: work,
        stdio: 'inherit',
      });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const builders = {
  darwin: buildMacos,
  linux: buildLinux,
  win32: buildWindows,
};
console.log(
  `Building the file-read tracer for ${process.platform}${target ? ` (${target})` : ''}`
);
const build = builders[process.platform];
if (!build) {
  console.log(`No file-read tracer for ${process.platform} yet.`);
  process.exit(0);
}
build();
