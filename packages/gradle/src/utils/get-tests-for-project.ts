import { execGradleAsync } from './exec-gradle';
import { newLineSeparator } from './get-gradle-report';

export async function getTestsForProject(
  gradleProject: string
): Promise<string[] | undefined> {
  try {
    const task = `${gradleProject ? gradleProject + ':' : ''}test`;
    const testLines = (
      await execGradleAsync([task, `--info`, `--test-dry-run`, `--rerun`])
    )
      .toString()
      .split(newLineSeparator)
      .filter((line) => line.trim() !== '' && line.includes('SKIPPED'))
      .map((line) => line.split('>')?.[0]?.trim())
      .filter(Boolean);
    const tests = new Set([]);
    for (const line of testLines) {
      try {
        await execGradleAsync([
          task,
          `--test-dry-run`,
          `--rerun`,
          `--tests`,
          line,
        ]);
        tests.add(line);
      } catch (e) {}
    }
    return Array.from(tests);
  } catch (e) {}
}
