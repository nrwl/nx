// TS 6.0 enables `noUncheckedSideEffectImports`, which errors on plain
// `import './x.css'` unless the module is declared. TS matches wildcard
// ambient modules by prefix length only, so a bare '*.css' pattern here can
// shadow next's own typed '*.module.css'; the typed default export keeps
// CSS-module property access working when that happens.
declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
