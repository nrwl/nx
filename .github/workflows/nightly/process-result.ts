import * as fs from 'fs';
import { MatrixItem } from './process-matrix';

interface MatrixResult extends MatrixItem {
  status: 'success' | 'failure' | 'cancelled';
  duration: number;
}

interface ProcessedResults {
  codeowners: string;
  slack_message: string;
  slack_proj_duration: string;
  slack_pm_duration: string;
  has_golden_failures: string;
}

function trimSpace(res: string): string {
  return res.split('\n').map((l) => l.trim()).join('\n');
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

function processResults(combined: MatrixResult[]): ProcessedResults {
  const failedProjects = combined.filter(c => c.status === 'failure' || c.status === 'cancelled').sort((a, b) => a.project.localeCompare(b.project));
  const failedGoldenProjects = failedProjects.filter(c => c.is_golden);
  const hasGoldenFailures = failedGoldenProjects.length > 0;
  const codeowners = new Set<string>();
  failedGoldenProjects.forEach(c => codeowners.add(c.codeowners));

  let result = '';

  const allGoldenProjects = combined.filter(c => c.is_golden);
  const uniqueGoldenProjects = new Set(allGoldenProjects.map(c => c.project));
  const uniqueFailedGoldenProjects = new Set(failedGoldenProjects.map(c => c.project));
  const goldenPassingCount = uniqueGoldenProjects.size - uniqueFailedGoldenProjects.size;
  const goldenFailingCount = uniqueFailedGoldenProjects.size;

  const allOtherProjects = combined.filter(c => !c.is_golden);
  const uniqueOtherProjects = new Set(allOtherProjects.map(c => c.project));
  const failedRegularProjects = failedProjects.filter(c => !c.is_golden);
  const uniqueFailedOtherProjects = new Set(failedRegularProjects.map(c => c.project));
  const otherPassingCount = uniqueOtherProjects.size - uniqueFailedOtherProjects.size;
  const otherFailingCount = uniqueFailedOtherProjects.size;

  result += `\n🌟 *Golden Projects*`;
  result += `\n✅ Passing: ${goldenPassingCount}`;
  result += `\n❌ Failing: ${goldenFailingCount}`;

  if (failedGoldenProjects.length > 0) {
    result += `\n\n🚨 *Failed Golden Projects*\n\`\`\``;
    result += `\n| Failed project                 |`;
    result += `\n|--------------------------------|`;
    let lastProject: string | undefined;
    failedGoldenProjects.forEach(matrix => {
      const project = matrix.project !== lastProject ? matrix.project : '';
      if (project) {
        result += `\n| ${project.padEnd(30)} |`;
        lastProject = matrix.project;
      }
    });
    result += `\n\`\`\``;
  }

  result += `\n\n🔧 *Other Projects*`;
  result += `\n✅ Passing: ${otherPassingCount}`;
  result += `\n❌ Failing: ${otherFailingCount}`;

  // Failed Other Projects Table (if any)
  if (failedRegularProjects.length > 0) {
    result += `\n\n⚠️ *Failed Other Projects*\n\`\`\``;
    result += `\n| Failed project                 |`;
    result += `\n|--------------------------------|`;
    let lastProject: string | undefined;
    failedRegularProjects.forEach(matrix => {
      const project = matrix.project !== lastProject ? matrix.project : '';
      if (project) {
        result += `\n| ${project.padEnd(30)} |`;
        lastProject = matrix.project;
      }
    });
    result += `\n\`\`\``;
  }

  if (failedProjects.length === 0) {
    result = '🎉 *No test failures detected!* All systems green! 🟢';
  }

  const timeReport: Record<string, { min: number; max: number; minEnv: string; maxEnv: string }> = {};
  const pmReport = { npm: 0, yarn: 0, pnpm: 0 };
  const macosProjects = ['e2e-detox', 'e2e-expo', 'e2e-react-native'];

  combined.forEach(matrix => {
    const nodeVersion = parseInt(matrix.node_version.toString());
    if (matrix.os_name === 'Linux' && nodeVersion === 20 && matrix.package_manager in pmReport) {
      pmReport[matrix.package_manager as keyof typeof pmReport] += matrix.duration;
    }
    if (matrix.os_name === 'Linux' || macosProjects.includes(matrix.project)) {
      if (timeReport[matrix.project]) {
        if (matrix.duration > timeReport[matrix.project].max) {
          timeReport[matrix.project].max = matrix.duration;
          timeReport[matrix.project].maxEnv = `${matrix.os_name}, ${matrix.package_manager}`;
        }
        if (matrix.duration < timeReport[matrix.project].min) {
          timeReport[matrix.project].min = matrix.duration;
          timeReport[matrix.project].minEnv = `${matrix.os_name}, ${matrix.package_manager}`;
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

  Object.keys(timeReport).forEach(proj => {
    resultPkg += `\n| ${proj.padEnd(30)} |                           |`;
    resultPkg += `\n| ${durationIcon(proj, 'min').padStart(29)} | ${mapProjectTime(proj, 'min').padEnd(25)} |`;
    resultPkg += `\n| ${durationIcon(proj, 'max').padStart(29)} | ${mapProjectTime(proj, 'max').padEnd(25)} |`;
  });
  resultPkg += `\`\`\``;

  let resultPm = `
    \`\`\`
    | PM   | Total time  |
    |------|-------------|`;
  Object.keys(pmReport).forEach(pm => {
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
    fs.appendFileSync(outputPath, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
  } else {
    fs.appendFileSync(outputPath, `${key}=${value}\n`);
  }
}

try {
  const combinedInput = process.argv[2]
    ? process.argv[2]
    : fs.readFileSync(0, 'utf-8').trim();

  const combined: MatrixResult[] = JSON.parse(combinedInput);
  const results = processResults(combined);

  Object.entries(results).forEach(([key, value]) => {
    setOutput(key, value);
  });
} catch (error) {
  console.error('Error processing results:', error);
  process.exit(1);
}
