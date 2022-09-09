export default function RawCssLoader(content: string, map: object) {
  const stringifiedContent = JSON.stringify(content);
  const stringifiedMap = map ? JSON.stringify(map) : `''`;
  return `module.exports = [[module.id, ${stringifiedContent}, '', ${stringifiedMap}]]`;
}
