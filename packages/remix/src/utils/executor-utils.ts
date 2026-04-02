// TODO(jack): Remove this cast when @nx/remix switches to moduleResolution:
// "nodenext". Vite 8 ships ESM-only type declarations (.d.mts) not resolvable
// under moduleResolution: "node".
export function loadViteDynamicImport() {
  return Function('return import("vite")')() as Promise<any>;
}
