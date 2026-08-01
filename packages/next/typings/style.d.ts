// TS 6.0 enables `noUncheckedSideEffectImports`, which errors on plain
// `import './x.css'` unless the module is declared. Equally-specific wildcard
// patterns resolve by registration order, so this bare '*.css' can shadow
// next's own typed '*.module.css'; the class-map default export keeps
// CSS-module property access working even when it shadows.
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
