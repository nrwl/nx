#!/usr/bin/env npx tsx
/**
 * gather-sandbox-context: Parse sandbox report + gather Nx task context
 * Produces structured JSON for the diagnose-sandbox-report skill
 *
 * Usage: npx tsx gather-sandbox-context.ts <report.json or URL> [--filter <pattern>] [--workspace <path>]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, extname, dirname } from 'path';
import { execSync, execFileSync } from 'child_process';
import { minimatch } from 'minimatch';

// --- CLI argument parsing ---

interface Args {
  reportFile: string;
  filter: string | null;
  workspaceRoot: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let reportFile = '';
  let filter: string | null = null;
  let workspaceRoot = process.cwd();

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--filter':
        filter = args[++i];
        break;
      case '--workspace':
        workspaceRoot = args[++i];
        break;
      case '--help':
      case '-h':
        console.error(
          'Usage: gather-sandbox-context <report.json or URL> [--filter <pattern>] [--workspace <path>]'
        );
        process.exit(1);
      default:
        if (args[i].startsWith('-')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
        reportFile = args[i];
    }
  }

  if (!reportFile) {
    console.error(
      'Usage: gather-sandbox-context <report.json or URL> [--filter <pattern>] [--workspace <path>]'
    );
    process.exit(1);
  }

  return { reportFile, filter, workspaceRoot };
}

// --- Types ---

interface FileAccessEntry {
  path: string;
  pid: number;
}

interface ProcessTreeEntry {
  pid: number;
  cmd: string;
  parentPid?: number;
}

interface SandboxReport {
  taskId: string;
  unexpectedReads?: FileAccessEntry[];
  unexpectedWrites?: FileAccessEntry[];
  expectedInputsNotRead?: string[];
  expectedOutputsNotWritten?: string[];
  filesRead?: FileAccessEntry[];
  filesWritten?: FileAccessEntry[];
  processTree?: ProcessTreeEntry[];
}

// --- Helpers ---

function downloadUrl(url: string): string {
  const tmpPath = `/tmp/sandbox-report-${Date.now()}.json`;
  try {
    execFileSync('curl', ['-sL', '-o', tmpPath, url], { stdio: 'pipe' });
  } catch {
    console.error(`Error: Failed to download report from URL: ${url}`);
    process.exit(1);
  }
  return tmpPath;
}

function runNxCommand(
  args: string[],
  workspaceRoot: string,
  timeoutMs = 30000
): string | null {
  try {
    return execFileSync('npx', ['nx', ...args], {
      cwd: workspaceRoot,
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch {
    return null;
  }
}

function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function filterEntries(
  entries: FileAccessEntry[],
  filterStr: string | null
): FileAccessEntry[] {
  if (!filterStr) return entries;

  const patterns = filterStr.split(',').map((p) => p.trim());
  return entries.filter((entry) =>
    patterns.some((pattern) => {
      if (
        pattern.includes('*') ||
        pattern.includes('?') ||
        pattern.includes('[')
      ) {
        // Glob pattern — if no slashes, match against basename
        if (!pattern.includes('/')) {
          return minimatch(basename(entry.path), pattern);
        }
        return minimatch(entry.path, pattern);
      }
      // Literal: exact match or directory prefix
      return entry.path === pattern || entry.path.startsWith(pattern + '/');
    })
  );
}

function groupByDirPrefix(
  paths: string[],
  depth = 3
): { prefix: string; count: number }[] {
  const groups: Record<string, number> = {};
  for (const p of paths) {
    const prefix = p.split('/').slice(0, depth).join('/');
    groups[prefix] = (groups[prefix] || 0) + 1;
  }
  return Object.entries(groups)
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);
}

function groupByExtension(paths: string[]): { ext: string; count: number }[] {
  const groups: Record<string, number> = {};
  for (const p of paths) {
    const ext = extname(p) || '(no ext)';
    groups[ext] = (groups[ext] || 0) + 1;
  }
  return Object.entries(groups)
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count);
}

function classifyFiles(
  undeclared: string[],
  projectRoot: string,
  projectRoots: Record<string, string>
) {
  const projects = Object.entries(projectRoots).map(([project, root]) => ({
    project,
    root,
  }));

  const isBuildArtifact = (f: string) =>
    f.startsWith('dist/') ||
    f.startsWith('build/') ||
    f.startsWith('out-tsc/') ||
    f.startsWith('.next/') ||
    f.includes('/node_modules/.cache/') ||
    f.endsWith('.tsbuildinfo') ||
    f.includes('/dist/') ||
    f.includes('/build/output/');

  const configBasenames = new Set(['nx.json', 'project.json', 'package.json']);
  const configPrefixes = [
    'tsconfig',
    'jest.config',
    'jest.preset',
    '.eslintrc',
    'eslint.config',
    'playwright.config',
    'webpack.config',
    'vite.config',
    'babel.config',
    '.babelrc',
    'rollup.config',
  ];
  const isConfigFile = (f: string) => {
    const b = basename(f);
    return (
      configBasenames.has(b) ||
      configPrefixes.some((prefix) => b.startsWith(prefix))
    );
  };

  const isEnvFile = (f: string) => {
    const b = basename(f);
    return b === '.env' || b.startsWith('.env.');
  };

  const classified = undeclared.map((f) => {
    const inProjectRoot = projectRoot !== '' && f.startsWith(projectRoot + '/');
    const owner = projects.find((p) => f.startsWith(p.root + '/'));
    return {
      path: f,
      inProjectRoot,
      ownerProject: owner?.project ?? null,
      isBuildArtifact: isBuildArtifact(f),
      isConfigFile: isConfigFile(f),
      isEnvFile: isEnvFile(f),
    };
  });

  return {
    crossProject: classified
      .filter((c) => !c.inProjectRoot)
      .map((c) => ({ path: c.path, owner: c.ownerProject })),
    buildArtifacts: classified
      .filter((c) => c.isBuildArtifact)
      .map((c) => c.path),
    configFiles: classified.filter((c) => c.isConfigFile).map((c) => c.path),
    envFiles: classified.filter((c) => c.isEnvFile).map((c) => c.path),
    inProjectRoot: classified.filter((c) => c.inProjectRoot).map((c) => c.path),
    outsideProjectRoot: classified
      .filter((c) => !c.inProjectRoot)
      .map((c) => c.path),
    total: undeclared.length,
  };
}

function validateViolations(
  violations: string[],
  resolvedFiles: Set<string>
): { confirmed: string[]; undeclared: string[] } {
  const confirmed: string[] = [];
  const undeclared: string[] = [];
  const seen = new Set<string>();
  for (const f of violations) {
    if (seen.has(f)) continue;
    seen.add(f);
    if (resolvedFiles.has(f)) {
      confirmed.push(f);
    } else {
      undeclared.push(f);
    }
  }
  return { confirmed, undeclared };
}

function validateOutputViolations(
  violations: string[],
  resolvedOutputs: string[]
): { confirmed: string[]; undeclared: string[] } {
  const outputSet = new Set(resolvedOutputs);
  const outputDirs = resolvedOutputs.map((o) => o + '/');
  const confirmed: string[] = [];
  const undeclared: string[] = [];
  const seen = new Set<string>();
  for (const f of violations) {
    if (seen.has(f)) continue;
    seen.add(f);
    if (outputSet.has(f) || outputDirs.some((d) => f.startsWith(d))) {
      confirmed.push(f);
    } else {
      undeclared.push(f);
    }
  }
  return { confirmed, undeclared };
}

function extractCommands(
  processTree: ProcessTreeEntry[],
  readsByPid: Record<string, string[]>,
  writesByPid: Record<string, string[]>
) {
  const pidToCmd: Record<string, string> = {};
  for (const entry of processTree) {
    pidToCmd[String(entry.pid)] = entry.cmd;
  }

  return processTree
    .filter(
      (entry) =>
        (readsByPid[String(entry.pid)]?.length ?? 0) > 0 ||
        (writesByPid[String(entry.pid)]?.length ?? 0) > 0
    )
    .map((entry) => {
      const parts = entry.cmd.split(' ');
      const exe = parts[0].split('/').pop() ?? parts[0];
      return {
        pid: entry.pid,
        cmd: entry.cmd,
        parentPid: entry.parentPid ?? null,
        parentCmd: entry.parentPid
          ? (pidToCmd[String(entry.parentPid)] ?? null)
          : null,
        unexpectedReadCount: readsByPid[String(entry.pid)]?.length ?? 0,
        unexpectedWriteCount: writesByPid[String(entry.pid)]?.length ?? 0,
        unexpectedReads: readsByPid[String(entry.pid)] ?? [],
        unexpectedWrites: writesByPid[String(entry.pid)] ?? [],
        executable: exe,
        arguments: parts.slice(1).join(' '),
      };
    })
    .sort(
      (a, b) =>
        b.unexpectedReadCount +
        b.unexpectedWriteCount -
        (a.unexpectedReadCount + a.unexpectedWriteCount)
    );
}

function resolveExecutorSource(
  executor: string | undefined,
  workspaceRoot: string
): { executor: string; sourcePath: string } {
  if (
    !executor ||
    executor === 'null' ||
    executor.includes('nx:run-commands')
  ) {
    return { executor: executor ?? '', sourcePath: '' };
  }

  const lastColon = executor.lastIndexOf(':');
  const pkg = executor.substring(0, lastColon);
  const name = executor.substring(lastColon + 1);

  try {
    const result = execFileSync(
      'node',
      [
        '-e',
        `
      try {
        const pkg = require('${pkg}/package.json');
        const executors = pkg.executors || pkg.builders;
        if (executors) {
          const p = require.resolve('${pkg}/' + executors);
          const dir = require('path').dirname(p);
          const json = require(p);
          const impl = json.executors?.['${name}']?.implementation ||
                       json.builders?.['${name}']?.implementation;
          if (impl) console.log(require.resolve(dir + '/' + impl));
        }
      } catch(e) {}
    `,
      ],
      {
        cwd: workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      }
    ).trim();
    return { executor, sourcePath: result };
  } catch {
    return { executor, sourcePath: '' };
  }
}

function extractDepTaskOutputFiles(
  targetConfig: any,
  workspaceRoot: string
): { dependentTasksOutputFiles: any[]; namedInputs: string[] } {
  const inputs: any[] = targetConfig?.inputs ?? [];
  const depOutputs: any[] = [];
  const namedInputs: string[] = [];

  for (const input of inputs) {
    if (
      typeof input === 'object' &&
      input !== null &&
      'dependentTasksOutputFiles' in input
    ) {
      depOutputs.push({
        glob: input.dependentTasksOutputFiles,
        transitive: input.transitive ?? false,
      });
    } else if (
      typeof input === 'string' &&
      !input.startsWith('{') &&
      !input.startsWith('^') &&
      !input.includes('/') &&
      !input.includes('.')
    ) {
      namedInputs.push(input);
    }
  }

  // Resolve named inputs from nx.json
  const nxJsonPath = resolve(workspaceRoot, 'nx.json');
  if (existsSync(nxJsonPath) && namedInputs.length > 0) {
    try {
      const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
      for (const name of namedInputs) {
        const namedDef = nxJson.namedInputs?.[name] ?? [];
        for (const entry of namedDef) {
          if (
            typeof entry === 'object' &&
            entry !== null &&
            'dependentTasksOutputFiles' in entry
          ) {
            depOutputs.push({
              glob: entry.dependentTasksOutputFiles,
              transitive: entry.transitive ?? false,
              fromNamedInput: name,
            });
          }
        }
      }
    } catch {
      // ignore nx.json parse errors
    }
  }

  return { dependentTasksOutputFiles: depOutputs, namedInputs };
}

function analyzeStaleDeclarations(
  expectedInputsNotRead: string[],
  expectedOutputsNotWritten: string[]
) {
  const classifyPattern = (value: string) => {
    if (/[*{]/.test(value)) return 'glob';
    if (value.startsWith('^')) return 'depOutput';
    return 'file';
  };

  const groupByType = (items: string[]) => {
    const groups: Record<string, string[]> = {};
    for (const item of items) {
      const type = classifyPattern(item);
      (groups[type] ??= []).push(item);
    }
    return Object.entries(groups).map(([type, values]) => ({
      type,
      count: values.length,
      samples: values.slice(0, 3),
    }));
  };

  return {
    expectedInputsNotRead: expectedInputsNotRead.length,
    expectedOutputsNotWritten: expectedOutputsNotWritten.length,
    staleInputsByType: groupByType(expectedInputsNotRead),
    staleOutputsByType: groupByType(expectedOutputsNotWritten),
  };
}

// --- Main ---

async function main() {
  const args = parseArgs();
  let reportPath = args.reportFile;

  // Handle URL inputs
  if (reportPath.startsWith('http')) {
    reportPath = downloadUrl(reportPath);
  }

  if (!existsSync(reportPath)) {
    console.error(`Error: Report file not found: ${reportPath}`);
    process.exit(1);
  }

  reportPath = resolve(reportPath);
  process.chdir(args.workspaceRoot);

  // Phase 1: Parse report (single read)
  let report: SandboxReport;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  } catch {
    console.error(`Error: Report file is not valid JSON: ${reportPath}`);
    process.exit(1);
  }

  if (!report.taskId) {
    console.error('Error: Report file has no .taskId field');
    process.exit(1);
  }

  const [project, target, config] = report.taskId.split(':');
  const taskRef = config
    ? `${project}:${target}:${config}`
    : `${project}:${target}`;

  const unexpectedReads = report.unexpectedReads ?? [];
  const unexpectedWrites = report.unexpectedWrites ?? [];

  // Apply filter
  const filteredReads = filterEntries(unexpectedReads, args.filter);
  const filteredWrites = filterEntries(unexpectedWrites, args.filter);

  const readPaths = filteredReads.map((e) => e.path);
  const writePaths = filteredWrites.map((e) => e.path);

  // Build pid → files maps
  const readsByPid: Record<string, string[]> = {};
  const writesByPid: Record<string, string[]> = {};
  for (const entry of filteredReads) {
    (readsByPid[String(entry.pid)] ??= []).push(entry.path);
  }
  for (const entry of filteredWrites) {
    (writesByPid[String(entry.pid)] ??= []).push(entry.path);
  }

  // Phase 2: Gather Nx task context (run task + parallel nx commands)
  runNxCommand(['run', taskRef], args.workspaceRoot, 120000);

  const [
    targetConfigStr,
    projectConfigStr,
    resolvedInputsStr,
    resolvedOutputsStr,
    graphResult,
  ] = await Promise.all([
    runNxCommand(['show', 'target', taskRef, '--json'], args.workspaceRoot),
    runNxCommand(['show', 'project', project, '--json'], args.workspaceRoot),
    runNxCommand(
      ['show', 'target', 'inputs', taskRef, '--json'],
      args.workspaceRoot
    ),
    runNxCommand(
      ['show', 'target', 'outputs', taskRef, '--json'],
      args.workspaceRoot
    ),
    (() => {
      const graphPath = `/tmp/sandbox-project-graph-${Date.now()}.json`;
      runNxCommand(['graph', '--file', graphPath], args.workspaceRoot);
      try {
        return readFileSync(graphPath, 'utf-8');
      } catch {
        return '{"graph":{"nodes":{}}}';
      }
    })(),
  ]);

  const targetConfig = safeJsonParse(targetConfigStr, {} as any);
  const projectConfig = safeJsonParse(projectConfigStr, {} as any);
  const resolvedInputs = safeJsonParse(resolvedInputsStr, {} as any);
  const resolvedOutputs = safeJsonParse(resolvedOutputsStr, {} as any);
  const projectGraph = safeJsonParse(graphResult, {
    graph: { nodes: {} },
  } as any);

  // Phase 3: Validate violations
  const resolvedInputFiles = new Set([
    ...(resolvedInputs.files ?? []),
    ...(resolvedInputs.depOutputs ?? []),
  ]);
  const resolvedOutputFiles = [
    ...(resolvedOutputs.outputPaths ?? []),
    ...(resolvedOutputs.expandedOutputs ?? []),
  ];

  const checkInputs = validateViolations(readPaths, resolvedInputFiles);
  const checkOutputs = validateOutputViolations(
    writePaths,
    resolvedOutputFiles
  );

  // Phase 3.5: Sample --check verification
  let checkSampleInputs: any = {};
  let checkSampleOutputs: any = {};
  const sampleReadFiles = checkInputs.undeclared.slice(0, 5);
  if (sampleReadFiles.length > 0) {
    const result = runNxCommand(
      [
        'show',
        'target',
        'inputs',
        taskRef,
        '--check',
        ...sampleReadFiles,
        '--json',
      ],
      args.workspaceRoot
    );
    checkSampleInputs = safeJsonParse(result, {});
  }
  const sampleWriteFiles = checkOutputs.undeclared.slice(0, 5);
  if (sampleWriteFiles.length > 0) {
    const result = runNxCommand(
      [
        'show',
        'target',
        'outputs',
        taskRef,
        '--check',
        ...sampleWriteFiles,
        '--json',
      ],
      args.workspaceRoot
    );
    checkSampleOutputs = safeJsonParse(result, {});
  }

  // Phase 4: File classification
  const projectRoots: Record<string, string> = {};
  for (const [name, node] of Object.entries(projectGraph.graph?.nodes ?? {})) {
    projectRoots[name] = (node as any).data?.root ?? name;
  }
  const taskProjectRoot = projectRoots[project] ?? '';

  const readClassification = classifyFiles(
    checkInputs.undeclared,
    taskProjectRoot,
    projectRoots
  );
  const writeClassification = classifyFiles(
    checkOutputs.undeclared,
    taskProjectRoot,
    projectRoots
  );

  // Phase 5: Command extraction
  const processTree = report.processTree ?? [];
  const commands = extractCommands(processTree, readsByPid, writesByPid);

  // Phase 6: Inference detection
  const targetMeta = projectConfig.targets?.[target]?.metadata ?? {};
  const inference = {
    isInferred: 'plugin' in targetMeta || 'technologies' in targetMeta,
    plugin: targetMeta.plugin ?? null,
    technologies: targetMeta.technologies ?? null,
    description: targetMeta.description ?? null,
  };

  let pluginRegistration: any = {};
  const nxJsonPath = resolve(args.workspaceRoot, 'nx.json');
  if (inference.plugin && existsSync(nxJsonPath)) {
    try {
      const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
      const plugins = (nxJson.plugins ?? []).map((p: any) =>
        typeof p === 'string' ? { plugin: p, options: {} } : p
      );
      pluginRegistration =
        plugins.find((p: any) => p.plugin === inference.plugin) ?? {};
    } catch {
      // ignore
    }
  }

  // Phase 6.5: dependentTasksOutputFiles + executor resolution
  const depTaskOutputs = extractDepTaskOutputFiles(
    targetConfig,
    args.workspaceRoot
  );
  const executorInfo = resolveExecutorSource(
    targetConfig.executor ?? targetConfig.command,
    args.workspaceRoot
  );

  // Phase 7: Cross-project dependency check
  const dependsOn = (targetConfig.dependsOn ?? []).map((d: any) =>
    typeof d === 'string' ? d : (d.target ?? '')
  );
  const checkCrossProject = (classification: typeof readClassification) => {
    const owners = [
      ...new Set(
        classification.crossProject
          .map((c) => c.owner)
          .filter((o): o is string => o !== null)
      ),
    ];
    return owners.map((owner) => ({
      project: owner,
      isDependency: dependsOn.some(
        (d: string) =>
          d === owner ||
          d === `${owner}:build` ||
          d === `^${owner}:build` ||
          d.includes(`^${owner}`)
      ),
      files: classification.crossProject
        .filter((c) => c.owner === owner)
        .map((c) => c.path),
    }));
  };

  const crossProjectDeps = {
    reads: checkCrossProject(readClassification),
    writes: checkCrossProject(writeClassification),
  };

  // Phase 8: Stale declarations
  const staleDeclarations = analyzeStaleDeclarations(
    report.expectedInputsNotRead ?? [],
    report.expectedOutputsNotWritten ?? []
  );

  // Assemble outputs
  const detailFile = `/tmp/sandbox-diagnosis-detail-${taskRef.replace(/[/:@]/g, '-')}.json`;

  const detail = {
    processTree: {
      processTree,
      processPidToCmd: Object.fromEntries(
        processTree.map((e) => [String(e.pid), e.cmd])
      ),
      readsByPid,
      writesByPid,
    },
    targetConfig,
    projectConfig,
    resolvedInputs,
    resolvedOutputs,
    validation: { reads: checkInputs, writes: checkOutputs },
    classification: { reads: readClassification, writes: writeClassification },
    report: {
      taskId: report.taskId,
      totalFilesRead: report.filesRead?.length ?? 0,
      totalFilesWritten: report.filesWritten?.length ?? 0,
      totalUnexpectedReads: unexpectedReads.length,
      totalUnexpectedWrites: unexpectedWrites.length,
      expectedInputsNotRead: report.expectedInputsNotRead ?? [],
      expectedOutputsNotWritten: report.expectedOutputsNotWritten ?? [],
    },
    commands,
    crossProjectDependencyCheck: crossProjectDeps,
    staleDeclarations,
    inference,
    pluginRegistration,
    dependentTasksOutputFiles: depTaskOutputs,
    executorInfo,
  };
  writeFileSync(detailFile, JSON.stringify(detail, null, 2));

  // Brief to stdout
  const brief = {
    task: {
      ref: taskRef,
      project,
      target,
      configuration: config ?? null,
      projectRoot: taskProjectRoot,
    },
    summary: {
      unexpectedReads: unexpectedReads.length,
      unexpectedWrites: unexpectedWrites.length,
      filteredReads: filteredReads.length,
      filteredWrites: filteredWrites.length,
      filterApplied: args.filter !== null,
      filterPattern: args.filter,
      confirmedReads: checkInputs.confirmed.length,
      undeclaredReads: checkInputs.undeclared.length,
      confirmedWrites: checkOutputs.confirmed.length,
      undeclaredWrites: checkOutputs.undeclared.length,
    },
    undeclaredFiles: {
      reads: checkInputs.undeclared,
      writes: checkOutputs.undeclared,
    },
    grouping: {
      readsByDirectory: groupByDirPrefix(readPaths),
      writesByDirectory: groupByDirPrefix(writePaths),
      byExtension: {
        readsByExt: groupByExtension(readPaths),
        writesByExt: groupByExtension(writePaths),
      },
    },
    commands: commands.map(
      ({
        pid,
        cmd,
        parentCmd,
        executable,
        arguments: args,
        unexpectedReadCount,
        unexpectedWriteCount,
      }) => ({
        pid,
        cmd,
        parentCmd,
        executable,
        arguments: args,
        unexpectedReadCount,
        unexpectedWriteCount,
      })
    ),
    checkSample: {
      inputs: checkSampleInputs,
      outputs: checkSampleOutputs,
    },
    classificationSummary: {
      reads: {
        crossProject: readClassification.crossProject.length,
        buildArtifacts: readClassification.buildArtifacts.length,
        configFiles: readClassification.configFiles.length,
        envFiles: readClassification.envFiles.length,
        inProjectRoot: readClassification.inProjectRoot.length,
        outsideProjectRoot: readClassification.outsideProjectRoot.length,
      },
      writes: {
        crossProject: writeClassification.crossProject.length,
        buildArtifacts: writeClassification.buildArtifacts.length,
        configFiles: writeClassification.configFiles.length,
        envFiles: writeClassification.envFiles.length,
        inProjectRoot: writeClassification.inProjectRoot.length,
        outsideProjectRoot: writeClassification.outsideProjectRoot.length,
      },
    },
    crossProjectDependencyCheck: crossProjectDeps,
    staleDeclarations,
    dependentTasksOutputFiles: depTaskOutputs.dependentTasksOutputFiles,
    executorInfo,
    inference,
    pluginRegistration,
    verificationCommands: {
      checkInputs: `npx nx show target inputs ${taskRef} --check <files...>`,
      checkOutputs: `npx nx show target outputs ${taskRef} --check <files...>`,
      runTask: `npx nx run ${taskRef} --skip-nx-cache`,
    },
    detailFile,
  };

  console.log(JSON.stringify(brief, null, 2));
}

main().catch((err) => {
  console.error(`Script failed: ${err.message}`);
  process.exit(1);
});
