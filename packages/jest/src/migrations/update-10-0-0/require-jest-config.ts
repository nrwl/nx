// export so that we can mock this return value
export function getJestObject(path: string) {
  return require(path);
}
