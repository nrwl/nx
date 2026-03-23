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

interface Streak {
  consecutive_failures: number;
  failing_since: string | null;
  last_passing: string | null;
}

interface HistoryEntry {
  date: string;
  failed: string[];
}

interface ErrorDate {
  testFile: string;
  startDate: string;
  days: number;
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

/**
 * Collects detailed failure information for golden projects.
 * Called by process-result.ts when golden failures exist.
 * Returns Slack mrkdwn formatted failure details.
 */
export async function collectFailureDetails(
  combined: MatrixResult[],
  failedGoldenProjectNames: string[]
): Promise<string> {
  const projectNames = failedGoldenProjectNames;
  if (projectNames.length === 0) return '';

  // Group failures by project for combo info
  const failuresByProject = new Map<string, MatrixResult[]>();
  for (const r of combined) {
    if (r.is_golden && (r.status === 'failure' || r.status === 'cancelled')) {
      if (!failuresByProject.has(r.project))
        failuresByProject.set(r.project, []);
      failuresByProject.get(r.project)!.push(r);
    }
  }

  // Step 1: 30-day failure history
  const histRunsRaw = gh(
    `run list --workflow=e2e-matrix.yml --repo ${REPO} --limit 40 --json databaseId,createdAt,event --jq '[.[] | select(.event == "schedule" and .databaseId != ${RUN_ID})] | .[0:30]'`
  );
  const histRuns: Array<{ databaseId: number; createdAt: string }> =
    histRunsRaw ? JSON.parse(histRunsRaw) : [];

  const histResults = await ghParallel(
    histRuns.map((r) => r.databaseId),
    (rid) =>
      `run view ${rid} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.conclusion == "failure") | .name | split(" ") | last] | unique'`
  );

  const history: HistoryEntry[] = histRuns.map((run) => {
    const raw = histResults.get(run.databaseId) || '[]';
    try {
      return { date: run.createdAt, failed: JSON.parse(raw) };
    } catch {
      return { date: run.createdAt, failed: [] };
    }
  });

  // Compute streaks
  const streaks = new Map<string, Streak>();
  for (const project of projectNames) {
    let streak = 0,
      firstSeen: string | null = null,
      lastPassing: string | null = null,
      broken = false;
    for (const entry of history) {
      if (broken) break;
      if (entry.failed.includes(project)) {
        streak++;
        firstSeen = entry.date;
      } else {
        broken = true;
        lastPassing = entry.date;
      }
    }
    streaks.set(project, {
      consecutive_failures: streak,
      failing_since: firstSeen ? firstSeen.split('T')[0] : null,
      last_passing: lastPassing ? lastPassing.split('T')[0] : null,
    });
  }

  // Step 2: Fetch failure logs (one per OS/PM combo per project)
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

  const projectLogs = new Map<string, string>();
  for (const [job, raw] of logResults) {
    if (!raw) continue;
    const block = extractJestBlocks(raw);
    projectLogs.set(
      job.project,
      (projectLogs.get(job.project) || '') + '\n' + block
    );
  }

  // Step 3: Per-project error validation
  const validations = new Map<
    string,
    {
      status: 'new' | 'confirmed' | 'different' | 'unknown';
      firstTestFiles: string[];
      currentTestFiles: string[];
    }
  >();

  for (const project of projectNames) {
    const streak = streaks.get(project)!;
    const currentFiles = extractTestFiles(projectLogs.get(project) || '');

    if (streak.consecutive_failures <= 1 || !streak.failing_since) {
      validations.set(project, {
        status: streak.consecutive_failures <= 1 ? 'new' : 'unknown',
        firstTestFiles: [],
        currentTestFiles: currentFiles,
      });
      continue;
    }

    const firstRun = histRuns.find(
      (r) => r.createdAt.split('T')[0] === streak.failing_since
    );
    if (!firstRun) {
      validations.set(project, {
        status: 'unknown',
        firstTestFiles: [],
        currentTestFiles: currentFiles,
      });
      continue;
    }

    const firstJobId = gh(
      `run view ${firstRun.databaseId} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.conclusion == "failure" and (.name | split(" ") | last) == "${project}")][0].databaseId'`
    );
    if (!firstJobId || firstJobId === 'null') {
      validations.set(project, {
        status: 'unknown',
        firstTestFiles: [],
        currentTestFiles: currentFiles,
      });
      continue;
    }

    const firstLog = gh(`api repos/${REPO}/actions/jobs/${firstJobId}/logs`);
    const firstFiles = extractTestFiles(firstLog ? extractJestBlocks(firstLog) : '');

    validations.set(project, {
      status:
        [...currentFiles].sort().join(',') === [...firstFiles].sort().join(',')
          ? 'confirmed'
          : 'different',
      firstTestFiles: firstFiles,
      currentTestFiles: currentFiles,
    });
  }

  // Step 4: Per-error binary search for "different" projects
  const errorDates = new Map<string, ErrorDate[]>();

  for (const [project, val] of validations) {
    if (val.status !== 'different') continue;
    const streak = streaks.get(project)!;
    const firstSet = new Set(val.firstTestFiles);
    const unreliable = val.currentTestFiles.filter((f) => !firstSet.has(f));
    if (!unreliable.length) continue;

    const projRunIds = histRuns
      .slice(0, streak.consecutive_failures)
      .map((r) => r.databaseId);
    if (projRunIds.length <= 1) continue;

    const dates: ErrorDate[] = [];
    for (const tf of unreliable) {
      let low = 0,
        high = projRunIds.length - 1;

      const oldestJobId = gh(
        `run view ${projRunIds[high]} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.conclusion == "failure" and (.name | split(" ") | last) == "${project}")][0].databaseId'`
      );
      let oldestHas = false;
      if (oldestJobId && oldestJobId !== 'null') {
        const log = gh(`api repos/${REPO}/actions/jobs/${oldestJobId}/logs`);
        oldestHas = new RegExp(`FAIL.*${tf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(log);
      }

      if (oldestHas) {
        const run = histRuns.find((r) => r.databaseId === projRunIds[high]);
        dates.push({
          testFile: tf,
          startDate: run?.createdAt.split('T')[0] || 'unknown',
          days: projRunIds.length,
        });
        continue;
      }

      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        const midJobId = gh(
          `run view ${projRunIds[mid]} --repo ${REPO} --json jobs --jq '[.jobs[] | select(.conclusion == "failure" and (.name | split(" ") | last) == "${project}")][0].databaseId'`
        );
        let midHas = false;
        if (midJobId && midJobId !== 'null') {
          const log = gh(`api repos/${REPO}/actions/jobs/${midJobId}/logs`);
          midHas = new RegExp(`FAIL.*${tf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(log);
        }
        if (midHas) low = mid;
        else high = mid;
      }

      const foundRun = histRuns.find((r) => r.databaseId === projRunIds[low]);
      dates.push({
        testFile: tf,
        startDate: foundRun?.createdAt.split('T')[0] || 'unknown',
        days: low + 1,
      });
    }
    errorDates.set(project, dates);
  }

  // Step 5: Recent commits
  let commitCount = 0;
  if (histRuns[0]?.createdAt) {
    try {
      const commits = execSync(
        `git log origin/master --after="${histRuns[0].createdAt}" --format="%h" --no-merges 2>/dev/null | head -30`,
        { encoding: 'utf-8', timeout: 10_000 }
      ).trim();
      commitCount = commits ? commits.split('\n').length : 0;
    } catch {
      /* git not available */
    }
  }

  // Step 6: Format report
  const lines: string[] = ['', '🔍 *Failure Details*', ''];

  const sorted = [...projectNames].sort((a, b) => {
    const sa = streaks.get(a)?.consecutive_failures || 0;
    const sb = streaks.get(b)?.consecutive_failures || 0;
    return (
      sa - sb ||
      (failuresByProject.get(b)?.length || 0) -
        (failuresByProject.get(a)?.length || 0)
    );
  });

  for (const project of sorted) {
    const streak = streaks.get(project)!;
    const val = validations.get(project);
    const block = projectLogs.get(project) || '';
    const testFiles = extractTestFiles(block);
    const projResults = failuresByProject.get(project) || [];

    const pms = [...new Set(projResults.map((r) => r.package_manager))];
    const pattern =
      pms.length === 1
        ? `${pms[0]}-only`
        : pms.length >= 3
          ? 'all PMs'
          : pms.join('+');

    const since = streak.failing_since || 'today (new)';
    const lastPass = streak.last_passing || '—';
    const uniqueCombos = [
      ...new Set(
        failedJobs.filter((j) => j.project === project).map((j) => j.combo)
      ),
    ];

    lines.push('———————————————————————————');
    lines.push(`*${project}* — ${projResults.length} combos (${pattern})`);
    lines.push(`Project failing since ${since} | Last fully passing: ${lastPass}`);
    lines.push('');

    if (testFiles.length > 0) {
      for (const tf of testFiles) {
        let errorDate = since;
        let errorDays: number | string = streak.consecutive_failures || 1;
        let label = '';

        const fileDates = errorDates.get(project);
        const fd = fileDates?.find((d) => d.testFile === tf);
        if (fd) {
          errorDate = fd.startDate;
          errorDays = fd.days;
        }

        if (val?.status === 'different' && !val.firstTestFiles.includes(tf)) {
          label = ' ⚠️ error changed mid-streak';
        }
        if (errorDays === 1 || errorDays === '1') {
          label = ' 🆕 NEW';
        }

        lines.push(
          `📋 \`${tf}\` — failing since ${errorDate} (${errorDays} ${errorDays === 1 || errorDays === '1' ? 'day' : 'days'})${label}`
        );

        const fileBlock = extractBlockForFile(block, tf);
        if (fileBlock) {
          lines.push('```');
          lines.push(fileBlock);
          lines.push('```');
        }
      }

      const summaryMatch = block.match(/^Test Suites:.*$/m);
      if (summaryMatch) lines.push(`_${summaryMatch[0]}_`);
      lines.push(`Failing combos: ${uniqueCombos.join(', ')}`);
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

        // Extract the Nx failure summary block ("Running target...failed" + "Failed tasks:" + task list)
        const nxFailureBlock: string[] = [];
        let capturingNx = false;
        for (const l of cleaned) {
          if (/NX.*Running target.*failed/i.test(l)) capturingNx = true;
          if (capturingNx) {
            nxFailureBlock.push(l);
            // Stop after "Hint:" line or after 10 lines
            if (/^Hint:/i.test(l.trim()) || nxFailureBlock.length >= 10) {
              capturingNx = false;
            }
          }
        }

        // Also extract individual error lines (build errors, module errors, etc.)
        const errorLines = cleaned.filter((l) => {
          const trimmed = l.trim();
          if (trimmed.length < 10) return false;
          if (/warning|warn\b|deprecated|orphan|Node\.js 20|FORCE_JAVASCRIPT|\* \[new branch\]|\* \[new tag\]/i.test(trimmed)) return false;
          return (
            /^error TS\d+:|^Error:|^\s*error\b[:\s]|ERR!|ERESOLVE|##\[error\]/i.test(trimmed) ||
            /Cannot find module|ENOENT|EACCES|permission denied/i.test(trimmed) ||
            /Segmentation fault|killed|OOM|out of memory/i.test(trimmed) ||
            /command not found|No such file or directory/i.test(trimmed) ||
            /Process completed with exit code [^0]/i.test(trimmed)
          );
        });

        // Combine: Nx failure block first (most useful), then individual errors not already included
        const nxBlockText = nxFailureBlock.join('\n');
        const additionalErrors = errorLines
          .filter((l) => !nxBlockText.includes(l))
          .slice(0, 3);

        const relevantErrors = [
          ...nxFailureBlock,
          ...(additionalErrors.length > 0 ? ['', ...additionalErrors] : []),
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

  if (commitCount > 0) {
    lines.push(`_${commitCount} commits since last nightly_`);
  }

  return lines.join('\n');
}
