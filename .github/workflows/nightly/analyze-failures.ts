import { exec } from 'child_process';
import { execSync } from 'child_process';

const MAX_CONCURRENCY = 8;

interface MatrixResult {
  project: string;
  codeowners: string;
  node_version: number | string;
  package_manager: string;
  os: string;
  os_name: string;
  os_timeout: number;
  is_golden?: boolean;
  status: 'success' | 'failure' | 'cancelled';
  duration: number;
}

const REPO = process.env.GITHUB_REPOSITORY || 'nrwl/nx';
const RUN_ID = process.env.GITHUB_RUN_ID || '0';

function gh(args: string): string {
  try {
    return execSync(`gh ${args}`, {
      encoding: 'utf-8',
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function ghAsync(args: string): Promise<string> {
  return new Promise((resolve) => {
    exec(
      `gh ${args}`,
      { encoding: 'utf-8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : (stdout || '').trim())
    );
  });
}

async function ghParallel<T>(
  items: T[],
  fn: (item: T) => string,
  concurrency = MAX_CONCURRENCY
): Promise<Map<T, string>> {
  const results = new Map<T, string>();
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()!;
      results.set(item, await ghAsync(fn(item)));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function extractJestBlocks(raw: string): string {
  const lines = raw
    .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .split('\n');

  const blocks: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (line.startsWith(' FAIL ')) capturing = true;
    if (capturing) blocks.push(line);
    if (line.startsWith('Ran all test suites')) capturing = false;
  }
  return blocks.slice(0, 50).join('\n');
}

function extractTestFiles(block: string): string[] {
  const matches = block.match(/FAIL\s+\S+\s+(src\/[^\s]+\.test\.ts)/g) || [];
  return [...new Set(matches.map((m) => m.replace(/FAIL\s+\S+\s+/, '')))];
}

// Extract a normalized error signature for a test file from a Jest block.
// Used to distinguish different root causes for the same test file across runs.
function extractErrorSignature(block: string, testFile: string): string {
  const lines = block.split('\n');
  let afterBullet = false;
  let inFile = false;
  for (const l of lines) {
    if (l.includes('FAIL') && l.includes(testFile)) { inFile = true; continue; }
    if (inFile && /●/.test(l)) { afterBullet = true; continue; }
    if (!inFile || !afterBullet) continue;
    const trimmed = l.trim();
    if (!trimmed) continue;
    // Skip generic "Command failed" and warnings — find the actual error
    if (/^Command failed:|^warning /i.test(trimmed)) continue;
    // Normalize dynamic parts
    return trimmed
      .replace(/\/tmp\/[^\s]+/g, '<tmpdir>')
      .replace(/\/Users\/[^\s]+/g, '<path>')
      .replace(/\/home\/[^\s]+/g, '<path>')
      .replace(/[a-z]+\d{5,}/gi, '<id>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:._Z-]+/g, '<ts>')
      .replace(/\d+\.\d+\.\d+/g, '<ver>')
      .trim();
  }
  return '';
}

// Extract signatures for all test files in a block
function extractSignatures(
  block: string,
  testFiles: string[]
): Map<string, string> {
  const sigs = new Map<string, string>();
  for (const tf of testFiles) {
    sigs.set(tf, extractErrorSignature(block, tf));
  }
  return sigs;
}

function extractBlockForFile(fullBlock: string, testFile: string): string {
  const lines = fullBlock.split('\n');
  const result: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (line.includes('FAIL') && line.includes(testFile)) capturing = true;
    else if (capturing && line.match(/^ FAIL /)) capturing = false;
    if (capturing) result.push(line);
  }
  return result.slice(0, 20).join('\n');
}

export interface JobLink {
  combo: string;
  url: string;
}

export interface FailureDetailsResult {
  report: string;
  goldenJobLinks: Map<string, JobLink[]>; // project -> [{combo, url}]
}

/**
 * Collects detailed failure information for golden projects.
 * Called by process-result.ts when golden failures exist.
 * Returns Slack mrkdwn report + job links for the summary section.
 */
export async function collectFailureDetails(
  combined: MatrixResult[],
  failedGoldenProjectNames: string[]
): Promise<FailureDetailsResult> {
  const projectNames = failedGoldenProjectNames;
  if (projectNames.length === 0) {
    return { report: '', goldenJobLinks: new Map() };
  }

  // Group failures by project for combo info
  const failuresByProject = new Map<string, MatrixResult[]>();
  for (const r of combined) {
    if (r.is_golden && (r.status === 'failure' || r.status === 'cancelled')) {
      if (!failuresByProject.has(r.project))
        failuresByProject.set(r.project, []);
      failuresByProject.get(r.project)!.push(r);
    }
  }

  // Step 1: Fetch failure logs (one per OS/PM combo per project)
  const failedJobsRaw = gh(
    `run view ${RUN_ID} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.conclusion == "failure") | {id: .databaseId, name: .name, project: (.name | split(" ") | last), combo: (.name | split(" ")[0])}]'`
  );
  const failedJobs: Array<{
    id: number;
    name: string;
    project: string;
    combo: string;
  }> = failedJobsRaw ? JSON.parse(failedJobsRaw) : [];

  const jobsToFetch: Array<{ id: number; project: string }> = [];
  for (const project of projectNames) {
    const seen = new Set<string>();
    for (const job of failedJobs.filter((j) => j.project === project)) {
      const key = job.combo.split('/').slice(0, 2).join('/');
      if (!seen.has(key)) {
        seen.add(key);
        jobsToFetch.push({ id: job.id, project: job.project });
      }
    }
  }

  const logResults = await ghParallel(
    jobsToFetch,
    (job) => `api repos/${REPO}/actions/jobs/${job.id}/logs`
  );

  // Keep per-combo logs separate AND a merged block per project
  interface ComboLog {
    combo: string;
    block: string;
    testFiles: string[];
    signatures: Map<string, string>; // testFile -> error signature
  }
  const projectComboLogs = new Map<string, ComboLog[]>();
  const projectLogs = new Map<string, string>(); // merged block for backwards compat

  for (const [job, raw] of logResults) {
    if (!raw) continue;
    const cleaned = raw
      .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm, '')
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const block = extractJestBlocks(raw);
    const testFiles = extractTestFiles(cleaned);
    const sigs = extractSignatures(cleaned, testFiles);
    const combo =
      failedJobs.find((j) => j.id === job.id)?.combo || 'unknown';

    if (!projectComboLogs.has(job.project))
      projectComboLogs.set(job.project, []);
    projectComboLogs.get(job.project)!.push({
      combo,
      block,
      testFiles,
      signatures: sigs,
    });

    projectLogs.set(
      job.project,
      (projectLogs.get(job.project) || '') + '\n' + block
    );
  }

  // Step 2: Build distinct failures per project — each (testFile, signature, combos) is a "failure"
  interface DistinctFailure {
    testFile: string;
    signature: string;
    combos: string[];
    block: string; // the Jest block from the first combo that has this signature
  }

  const projectDistinctFailures = new Map<string, DistinctFailure[]>();
  for (const project of projectNames) {
    const comboLogs = projectComboLogs.get(project) || [];
    const seen = new Map<string, DistinctFailure>(); // "testFile|signature" -> failure

    for (const cl of comboLogs) {
      for (const tf of cl.testFiles) {
        const sig = cl.signatures.get(tf) || '';
        const key = `${tf}|${sig}`;
        if (seen.has(key)) {
          seen.get(key)!.combos.push(cl.combo);
        } else {
          seen.set(key, {
            testFile: tf,
            signature: sig,
            combos: [cl.combo],
            block: extractBlockForFile(cl.block, tf),
          });
        }
      }
    }
    projectDistinctFailures.set(project, [...seen.values()]);
  }

  // Step 3: Format report
  const lines: string[] = ['', '🔍 *Failure Details*', ''];

  const sorted = [...projectNames].sort(
    (a, b) =>
      (failuresByProject.get(b)?.length || 0) -
        (failuresByProject.get(a)?.length || 0) || a.localeCompare(b)
  );

  for (const project of sorted) {
    const projResults = failuresByProject.get(project) || [];
    const distinctFailures = projectDistinctFailures.get(project) || [];
    const block = projectLogs.get(project) || '';

    const pms = [...new Set(projResults.map((r) => r.package_manager))];
    const pattern =
      pms.length === 1
        ? `${pms[0]}-only`
        : pms.length >= 3
          ? 'all PMs'
          : pms.join('+');

    const uniqueCombos = [
      ...new Set(
        failedJobs.filter((j) => j.project === project).map((j) => j.combo)
      ),
    ];

    lines.push('———————————————————————————');
    lines.push(`*${project}* — ${projResults.length} combos (${pattern})`);
    lines.push('');

    if (distinctFailures.length > 0) {
      for (const failure of distinctFailures) {
        const comboStr = failure.combos.join(', ');
        lines.push(`📋 \`${failure.testFile}\` (${comboStr})`);

        if (failure.block) {
          lines.push('```');
          lines.push(failure.block);
          lines.push('```');
        }
      }

      const summaryMatch = block.match(/^Test Suites:.*$/m);
      if (summaryMatch) lines.push(`_${summaryMatch[0]}_`);
    } else {
      // No Jest blocks — find which step failed and extract its error output
      const firstJob = failedJobs.find((j) => j.project === project);
      if (firstJob) {
        // Get the failed step name from the jobs API
        const stepsRaw = gh(
          `run view ${RUN_ID} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.databaseId == ${firstJob.id})][0].steps[] | select(.conclusion == "failure") | .name'`
        );
        const failedStep = stepsRaw || 'unknown step';

        // Get the log and extract error lines
        const raw = gh(`api repos/${REPO}/actions/jobs/${firstJob.id}/logs`);
        const cleaned = raw
          .split('\n')
          .map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, ''))
          .map((l) => l.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''));

        // Extract the failed Nx task output block (❌ > nx run <task> ... until next ##[group] or NX summary)
        const failedTaskBlock: string[] = [];
        let capturingTask = false;
        for (const l of cleaned) {
          if (/❌.*> nx run /i.test(l)) {
            capturingTask = true;
            failedTaskBlock.push(l);
            continue;
          }
          if (capturingTask) {
            if (/^##\[group\]|NX.*Running target/i.test(l) || failedTaskBlock.length >= 15) {
              capturingTask = false;
            } else {
              failedTaskBlock.push(l);
            }
          }
        }

        // Extract the Nx failure summary block ("Running target...failed" + "Failed tasks:" + task list)
        const nxFailureBlock: string[] = [];
        let capturingNx = false;
        for (const l of cleaned) {
          if (/NX.*Running target.*failed/i.test(l)) capturingNx = true;
          if (capturingNx) {
            nxFailureBlock.push(l);
            if (/^Hint:/i.test(l.trim()) || nxFailureBlock.length >= 10) {
              capturingNx = false;
            }
          }
        }

        // Fallback: if no Nx blocks or task blocks found, extract generic error lines
        let fallbackErrors: string[] = [];
        if (nxFailureBlock.length === 0 && failedTaskBlock.length === 0) {
          fallbackErrors = cleaned.filter((l) => {
            const t = l.trim();
            if (t.length < 10) return false;
            if (/warning|warn\b|deprecated|orphan|Node\.js 20|FORCE_JAVASCRIPT|\* \[new branch\]|\* \[new tag\]/i.test(t)) return false;
            return (
              /error TS\d+:|^Error:|^\s*error\b[:\s]|ERR!|ERESOLVE|##\[error\]/i.test(t) ||
              /Cannot find module|ENOENT|EACCES|permission denied/i.test(t) ||
              /Segmentation fault|killed|OOM|out of memory/i.test(t) ||
              /command not found|No such file or directory/i.test(t) ||
              /Process completed with exit code [^0]/i.test(t)
            );
          }).slice(0, 5);
        }

        // Combine: Nx summary first, then task output, then fallback errors
        const relevantErrors = [
          ...nxFailureBlock,
          ...(failedTaskBlock.length > 0 ? ['', ...failedTaskBlock] : []),
          ...(fallbackErrors.length > 0 ? ['', ...fallbackErrors] : []),
        ];

        lines.push(`⚠️ Tests did not run — failed at step: *${failedStep}*`);
        if (relevantErrors.length > 0) {
          lines.push('```');
          lines.push(relevantErrors.join('\n'));
          lines.push('```');
        }
        lines.push(`Failing combos: ${uniqueCombos.join(', ')}`);
      } else {
        lines.push('⏱️ No job data available');
      }
    }
    lines.push('');
  }

  // Build job links for the summary section
  const runUrl = `https://github.com/${REPO}/actions/runs/${RUN_ID}`;
  const goldenJobLinks = new Map<string, JobLink[]>();
  for (const project of projectNames) {
    const projectJobs = failedJobs.filter((j) => j.project === project);
    goldenJobLinks.set(
      project,
      projectJobs.map((j) => ({
        combo: j.combo,
        url: `${runUrl}/job/${j.id}`,
      }))
    );
  }

  return { report: lines.join('\n'), goldenJobLinks };
}
