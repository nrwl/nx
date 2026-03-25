// TODO(jack): Remove this cast when @nx/vitest switches to moduleResolution:
// "nodenext". Vite 8 ships ESM-only type declarations (.d.mts) not resolvable
// under moduleResolution: "node".
export function loadViteDynamicImport() {
  return Function('return import("vite")')() as Promise<any>;
}

export function loadVitestDynamicImport() {
  return Function('return import("vitest/node")')() as Promise<
    typeof import('vitest/node')
  >;
}
