// TS 6.0 enables `noUncheckedSideEffectImports`, which errors on plain
// `import './x.css'` unless the module is declared. Empty bodies allow the
// side-effect import without granting a default-import `any`.
declare module '*.css' {}
declare module '*.scss' {}
declare module '*.sass' {}
declare module '*.less' {}
