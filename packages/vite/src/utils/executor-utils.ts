export function loadViteDynamicImport() {
  return Function('return import("vite")')() as Promise<typeof import('vite')>;
}
