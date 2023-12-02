export function loadNuxiDynamicImport() {
  return Function('return import("nuxi")')() as Promise<typeof import('nuxi')>;
}

export function loadNuxtKitDynamicImport() {
  return Function('return import("@nuxt/kit")')() as Promise<
    typeof import('@nuxt/kit')
  >;
}
