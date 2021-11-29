import { TypeCheckResult } from './run-type-check';

export async function printDiagnostics(result: TypeCheckResult) {
  if (result.errors.length > 0) {
    result.errors.forEach((err) => {
      console.log(`${err}\n`);
    });

    console.log(
      `Found ${result.errors.length} error${
        result.errors.length > 1 ? 's' : ''
      }.`
    );
  } else if (result.warnings.length > 0) {
    result.warnings.forEach((err) => {
      console.log(`${err}\n`);
    });

    console.log(`Found ${result.warnings.length} warnings.`);
  }
}
