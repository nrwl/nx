export async function printDiagnostics(
  errors: string[] = [],
  warnings: string[] = []
) {
  if (errors.length > 0) {
    errors.forEach((err) => {
      console.log(`${err}\n`);
    });

    console.log(`Found ${errors.length} error${errors.length > 1 ? 's' : ''}.`);
  } else if (warnings.length > 0) {
    warnings.forEach((err) => {
      console.log(`${err}\n`);
    });

    console.log(`Found ${warnings.length} warnings.`);
  }
}
