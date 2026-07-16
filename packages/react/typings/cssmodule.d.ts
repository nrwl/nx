declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// TS 6.0 enables `noUncheckedSideEffectImports`, which errors on plain
// `import './x.css'` unless the module is declared. Empty bodies allow the
// side-effect import without granting a default-import `any`.
// Keep these below the '*.module.*' declarations - equally-specific wildcard
// patterns resolve by registration order and the typed modules must win.
declare module '*.css' {}
declare module '*.scss' {}
declare module '*.sass' {}
declare module '*.less' {}
