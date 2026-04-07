import { appendFileSync, readdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';

interface NodeDiagnosticReport {
  header: {
    event: string;
    trigger: string;
    filename: string | null;
    dumpEventTime: string;
    commandLine: string[];
    nodejsVersion: string;
    platform: string;
    arch: string;
  };
  nativeStack: Array<{ pc: string; symbol: string }>;
}

/**
 * Scans the workspace data directory for Node.js fatal error diagnostic
 * reports left behind by a previous process crash (e.g. SIGSEGV from a
 * native NAPI addon). If any are found, surfaces them in the console and —
 * when running inside GitHub Actions — as workflow annotations and a step
 * summary entry. Reports are deleted after surfacing so they don't accumulate.
 */
export function surfaceFatalErrorReports(workspaceDataDir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(workspaceDataDir);
  } catch {
    return;
  }

  const reportFiles = entries.filter(
    (f) => f.startsWith('report.') && f.endsWith('.json')
  );

  if (reportFiles.length === 0) {
    return;
  }

  for (const filename of reportFiles) {
    const reportPath = join(workspaceDataDir, filename);
    let report: NodeDiagnosticReport;
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
      continue;
    }

    if (report?.header?.event !== 'FatalError') {
      continue;
    }

    const { dumpEventTime, commandLine, nodejsVersion, platform, arch } =
      report.header;
    const command = commandLine?.slice(1).join(' ') ?? 'unknown';
    const topFrames = (report.nativeStack ?? [])
      .slice(0, 10)
      .map((f) => `  ${f.symbol ?? f.pc}`)
      .join('\n');

    const summary = [
      `Nx detected a fatal process crash (SIGSEGV/native addon error).`,
      `  Time:      ${dumpEventTime}`,
      `  Command:   ${command}`,
      `  Node:      ${nodejsVersion} (${platform}/${arch})`,
      `  Report:    ${reportPath}`,
      topFrames ? `  Top frames:\n${topFrames}` : null,
      ``,
      `Please report this at https://github.com/nrwl/nx/issues and attach the report file.`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    const reportedPath = reportPath.replace(/\.json$/, '.reported.json');
    try {
      renameSync(reportPath, reportedPath);
    } catch {
      // non-fatal: leave the original in place if rename fails
    }

    console.error(summary);
    emitGitHubActionsOutput(summary, reportedPath, dumpEventTime);
  }
}

function emitGitHubActionsOutput(
  summary: string,
  reportPath: string,
  timestamp: string
): void {
  if (!process.env.GITHUB_ACTIONS) {
    return;
  }

  // Emit a workflow annotation visible in the Actions log
  const title = `Nx fatal crash detected (${timestamp})`;
  const message = `Native addon crash. Report saved to ${reportPath}. Please open an Nx issue and attach the report.`;
  // Newlines must be URL-encoded in annotation values
  process.stdout.write(
    `::error title=${title}::${message.replace(/\n/g, '%0A')}\n`
  );

  // Append markdown to the step summary (visible in the job summary tab)
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    const md = [
      `## :warning: Nx fatal crash detected`,
      ``,
      `A previous Nx process crashed with a native error (SIGSEGV). This may indicate a bug in Nx's native addon.`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| Time | ${timestamp} |`,
      `| Report | \`${reportPath}\` |`,
      ``,
      `**Please [open an Nx issue](https://github.com/nrwl/nx/issues/new) and attach the report file.**`,
      ``,
      `<details><summary>Crash summary</summary>`,
      ``,
      '```',
      summary,
      '```',
      `</details>`,
      ``,
    ].join('\n');

    try {
      appendFileSync(stepSummaryPath, md);
    } catch {
      // non-fatal: summary file may not be writable
    }
  }
}
