export function loadNuxtKitDynamicImport() {
  return Function('return import("@nuxt/kit")')() as Promise<
    typeof import('@nuxt/kit')
  >;
}
