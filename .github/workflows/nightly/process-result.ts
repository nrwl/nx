import * as fs from 'fs';
import type { MatrixItem } from './process-matrix';
import { collectFailureDetails } from './analyze-failures';

interface MatrixResult extends MatrixItem {
  status: 'success' | 'failure' | 'cancelled';
  duration: number;
  test_started?: boolean;
}

interface ProcessedResults {
  codeowners: string;
  slack_message: string;
  slack_proj_duration: string;
  slack_pm_duration: string;
  has_golden_failures: string;
}

function trimSpace(res: string): string {
  return res
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

function humanizeDuration(num: number): string {
  let res = '';
  const hours = Math.floor(num / 3600);
  if (hours) res += `${hours}h `;
  const mins = Math.floor((num % 3600) / 60);
  if (mins) res += `${mins}m `;
  const sec = num % 60;
  if (sec) res += `${sec}s`;
  return res;
}

function matrixKey(item: MatrixItem): string {
  return JSON.stringify([
    item.project,
    item.os,
    item.package_manager,
    String(item.node_version),
  ]);
}

function reconcileResults(
  expected: unknown,
  uploaded: unknown
): { combined: MatrixResult[]; missing: MatrixItem[] } {
  if (
    !expected ||
    typeof expected !== 'object' ||
    !('include' in expected) ||
    !Array.isArray(expected.include)
  ) {
    throw new Error('Expected matrix must contain an include array.');
  }
  if (expected.include.length === 0) {
    throw new Error('No expected matrix combinations were supplied.');
  }
  if (!Array.isArray(uploaded)) {
    throw new Error('Matrix results must be an array.');
  }

  const expectedByKey = new Map<string, MatrixItem>();
  for (const item of expected.include) {
    if (
      !item ||
      typeof item !== 'object' ||
      !['project', 'os', 'os_name', 'package_manager', 'codeowners'].every(
        (key) => typeof item[key] === 'string' && item[key].length > 0
      ) ||
      !['string', 'number'].includes(typeof item.node_version) ||
      !String(item.node_version).length ||
      typeof item.os_timeout !== 'number' ||
      !Number.isFinite(item.os_timeout) ||
      (item.is_golden !== undefined && typeof item.is_golden !== 'boolean')
    ) {
      throw new Error('Invalid expected matrix combination.');
    }
    const key = matrixKey(item);
    if (expectedByKey.has(key))
      throw new Error(`Duplicate expected matrix combination: ${key}`);
    expectedByKey.set(key, item);
  }

  const resultsByKey = new Map<string, MatrixResult>();
  for (const item of uploaded) {
    if (
      !item ||
      typeof item !== 'object' ||
      !['success', 'failure', 'cancelled'].includes(item.status) ||
      typeof item.duration !== 'number' ||
      !Number.isFinite(item.duration) ||
      item.duration < 0 ||
      (item.test_started !== undefined &&
        typeof item.test_started !== 'boolean')
    ) {
      throw new Error('Invalid matrix result.');
    }
    const key = matrixKey(item);
    if (!expectedByKey.has(key))
      throw new Error(`Unexpected matrix result: ${key}`);
    if (resultsByKey.has(key))
      throw new Error(`Duplicate matrix result: ${key}`);
    resultsByKey.set(key, item);
  }

  const missing: MatrixItem[] = [];
  const combined = [...expectedByKey.entries()].map(
    ([key, item]): MatrixResult => {
      const result = resultsByKey.get(key);
      if (!result) {
        missing.push(item);
        return { ...item, status: 'failure', duration: 0, test_started: false };
      }
      return {
        ...item,
        status: result.status,
        duration: result.duration,
        test_started: result.test_started,
      };
    }
  );
  return { combined, missing };
}

function processResults(
  combined: MatrixResult[],
  missing: MatrixItem[]
): ProcessedResults {
  const failedProjects = combined
    .filter((c) => c.status === 'failure' || c.status === 'cancelled')
    .sort((a, b) => a.project.localeCompare(b.project));
  const failedGoldenProjects = failedProjects.filter((c) => c.is_golden);
  const hasGoldenFailures = failedGoldenProjects.length > 0;
  const codeowners = new Set<string>();
  failedGoldenProjects.forEach((c) => codeowners.add(c.codeowners));

  let result = '';

  const allGoldenProjects = combined.filter((c) => c.is_golden);
  const uniqueGoldenProjects = new Set(allGoldenProjects.map((c) => c.project));
  const uniqueFailedGoldenProjects = new Set(
    failedGoldenProjects.map((c) => c.project)
  );
  const goldenPassingCount =
    uniqueGoldenProjects.size - uniqueFailedGoldenProjects.size;
  const goldenFailingCount = uniqueFailedGoldenProjects.size;

  const allOtherProjects = combined.filter((c) => !c.is_golden);
  const uniqueOtherProjects = new Set(allOtherProjects.map((c) => c.project));
  const failedRegularProjects = failedProjects.filter((c) => !c.is_golden);
  const uniqueFailedOtherProjects = new Set(
    failedRegularProjects.map((c) => c.project)
  );
  const otherPassingCount =
    uniqueOtherProjects.size - uniqueFailedOtherProjects.size;
  const otherFailingCount = uniqueFailedOtherProjects.size;

  result += `\n🌟 *Golden Projects*`;
  result += `\n✅ Passing: ${goldenPassingCount} | ❌ Failing: ${goldenFailingCount}`;

  if (failedGoldenProjects.length > 0) {
    result += `\n\n🚨 *Failed Golden Projects*`;
    // Project names listed here — combo links added later by main() with job data
    const seenProjects = new Set<string>();
    failedGoldenProjects.forEach((matrix) => {
      if (!seenProjects.has(matrix.project)) {
        seenProjects.add(matrix.project);
        result += `\n\n*${matrix.project}*`;
        // Placeholder — main() will replace with linked combos
        result += `\n  {{COMBOS:${matrix.project}}}`;
      }
    });
  }

  if (otherFailingCount > 0) {
    const otherProjectCounts = new Map<string, number>();
    failedRegularProjects.forEach((m) => {
      otherProjectCounts.set(
        m.project,
        (otherProjectCounts.get(m.project) || 0) + 1
      );
    });
    const otherSummary = [...otherProjectCounts.entries()]
      .map(([p, c]) => `${p} (${c})`)
      .join(', ');
    result += `\n\n⚠️ *Failed Other Projects:* ${otherSummary}`;
  }

  if (failedProjects.length === 0) {
    result = '🎉 *No test failures detected!* All systems green! 🟢';
  }

  if (missing.length > 0) {
    result += '\n\n*Missing matrix results:*';
    for (const item of missing) {
      result += `\n${item.project} (${item.os}, ${item.package_manager}, Node ${item.node_version})`;
    }
  }

  const timeReport: Record<
    string,
    { min: number; max: number; minEnv: string; maxEnv: string }
  > = {};
  const pmReport = { npm: 0, yarn: 0, pnpm: 0 };
  const macosProjects = ['e2e-detox', 'e2e-expo', 'e2e-react-native'];

  combined.forEach((matrix) => {
    if (matrix.test_started === false) return;
    const nodeVersion = parseInt(matrix.node_version.toString());
    if (
      matrix.os_name === 'Linux' &&
      nodeVersion === 20 &&
      matrix.package_manager in pmReport
    ) {
      pmReport[matrix.package_manager as keyof typeof pmReport] +=
        matrix.duration;
    }
    if (matrix.os_name === 'Linux' || macosProjects.includes(matrix.project)) {
      if (timeReport[matrix.project]) {
        if (matrix.duration > timeReport[matrix.project].max) {
          timeReport[matrix.project].max = matrix.duration;
          timeReport[matrix.project].maxEnv =
            `${matrix.os_name}, ${matrix.package_manager}`;
        }
        if (matrix.duration < timeReport[matrix.project].min) {
          timeReport[matrix.project].min = matrix.duration;
          timeReport[matrix.project].minEnv =
            `${matrix.os_name}, ${matrix.package_manager}`;
        }
      } else {
        timeReport[matrix.project] = {
          min: matrix.duration,
          max: matrix.duration,
          minEnv: `${matrix.os_name}, ${matrix.package_manager}`,
          maxEnv: `${matrix.os_name}, ${matrix.package_manager}`,
        };
      }
    }
  });

  let resultPkg = `
    \`\`\`
    | Project                        | Time                      |
    |--------------------------------|---------------------------|`;

  function mapProjectTime(proj: string, section: 'min' | 'max'): string {
    return `${humanizeDuration(timeReport[proj][section])} (${timeReport[proj][`${section}Env`]})`;
  }

  function durationIcon(proj: string, section: 'min' | 'max'): string {
    const duration = timeReport[proj][section];
    if (duration < 12 * 60) return `${section} ✅`;
    if (duration < 15 * 60) return `${section} ❗`;
    return `${section} ❌`;
  }

  Object.keys(timeReport).forEach((proj) => {
    resultPkg += `\n| ${proj.padEnd(30)} |                           |`;
    resultPkg += `\n| ${durationIcon(proj, 'min').padStart(29)} | ${mapProjectTime(proj, 'min').padEnd(25)} |`;
    resultPkg += `\n| ${durationIcon(proj, 'max').padStart(29)} | ${mapProjectTime(proj, 'max').padEnd(25)} |`;
  });
  resultPkg += `\`\`\``;

  let resultPm = `
    \`\`\`
    | PM   | Total time  |
    |------|-------------|`;
  Object.keys(pmReport).forEach((pm) => {
    resultPm += `\n| ${pm.padEnd(4)} | ${humanizeDuration(pmReport[pm as keyof typeof pmReport]).padEnd(11)} |`;
  });
  resultPm += `\`\`\``;

  return {
    codeowners: Array.from(codeowners).join(','),
    slack_message: trimSpace(result),
    slack_proj_duration: trimSpace(resultPkg),
    slack_pm_duration: trimSpace(resultPm),
    has_golden_failures: hasGoldenFailures.toString(),
  };
}

function setOutput(key: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    console.warn(`GITHUB_OUTPUT not set. Skipping output for "${key}".`);
    return;
  }

  if (value.includes('\n')) {
    const delimiter = `EOF_${key}_${Date.now()}`;
    fs.appendFileSync(
      outputPath,
      `${key}<<${delimiter}\n${value}\n${delimiter}\n`
    );
  } else {
    fs.appendFileSync(outputPath, `${key}=${value}\n`);
  }
}

async function main() {
  const combinedInput = process.argv[2]
    ? process.argv[2]
    : fs.readFileSync(0, 'utf-8').trim();

  const { combined, missing } = reconcileResults(
    JSON.parse(process.env.EXPECTED_MATRIX ?? 'null'),
    JSON.parse(combinedInput)
  );
  const results = processResults(combined, missing);

  // Collect detailed failure info if golden failures exist
  if (results.has_golden_failures === 'true') {
    try {
      const failedProjects = [
        ...new Set(
          combined
            .filter(
              (c) =>
                c.is_golden &&
                (c.status === 'failure' || c.status === 'cancelled')
            )
            .map((c) => c.project)
        ),
      ];
      const { report, goldenJobLinks } = await collectFailureDetails(
        combined,
        failedProjects
      );

      // Replace combo placeholders in the summary with linked combos
      for (const [project, links] of goldenJobLinks) {
        const placeholder = `{{COMBOS:${project}}}`;
        const linkedCombos =
          links.length > 0
            ? links.map((l) => `  · <${l.url}|${l.combo}>`).join('\n')
            : '  (no job data)';
        results.slack_message = results.slack_message.replace(
          placeholder,
          linkedCombos
        );
      }

      // Remove any unreplaced placeholders (if collectFailureDetails didn't have data for a project)
      results.slack_message = results.slack_message.replace(
        /  \{\{COMBOS:[^}]+\}\}/g,
        '  (no job data)'
      );

      if (report) {
        results.slack_message += '\n\n' + report;
      }
    } catch (e) {
      console.error(
        'Failed to collect failure details (brief report will still be posted):',
        e
      );
      results.slack_message +=
        '\n\n⚠️ _Failed to collect detailed failure information_';
    }
  }

  Object.entries(results).forEach(([key, value]) => {
    setOutput(key, value);
  });
}

main().catch((error) => {
  console.error('Error processing results:', error);
  process.exit(1);
});
