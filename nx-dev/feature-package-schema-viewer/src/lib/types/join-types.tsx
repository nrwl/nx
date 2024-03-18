export function joinTypes<T extends JSX.Element>(
  arr: T[],
  sep: string
): (JSX.Element | string)[] {
  let results: Array<JSX.Element | string> = new Array<JSX.Element | string>();
  let first = true;
  let keyGen = 0;
  arr.forEach((a) => {
    if (!first) {
      results.push(<span key={keyGen}>{sep}</span>);
      keyGen++;
    } else {
      first = false;
    }
    results.push(<span key={keyGen}>{a}</span>);
    keyGen++;
  });
  return results;
}
