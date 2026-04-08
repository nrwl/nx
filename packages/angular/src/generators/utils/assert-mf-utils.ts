export function assertRspackIsCSR(bundler: 'webpack' | 'rspack', ssr: boolean) {
  if (bundler === 'rspack' && ssr) {
    throw new Error(
      'SSR is not currently supported for Angular Rspack Module Federation. Please use webpack instead.'
    );
  }
}
