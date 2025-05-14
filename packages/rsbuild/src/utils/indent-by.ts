export function indentBy(tabNumber: number) {
  return (str: string) => {
    const indentation = '\t'.repeat(tabNumber);
    return str
      .split('\n')
      .map((line) => `${indentation}${line}`)
      .join('\n');
  };
}
