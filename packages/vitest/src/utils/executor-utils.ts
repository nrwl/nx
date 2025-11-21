export function loadViteDynamicImport() {
  return Function('return import("vite")')() as Promise<typeof import('vite')>;
}

export function loadVitestDynamicImport() {
  return Function('return import("vitest/node")')() as Promise<
    typeof import('vitest/node')
  >;
}
