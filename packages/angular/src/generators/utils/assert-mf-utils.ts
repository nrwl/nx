export function assertRspackIsCSR(
  bundler: 'webpack' | 'rspack',
  ssr: boolean,
  serverRouting: boolean
) {
  if (bundler === 'rspack' && serverRouting) {
    throw new Error(
      'Server Routing is not currently supported for Angular Rspack Module Federation. Please use webpack instead.'
    );
  }
  if (bundler === 'rspack' && ssr) {
    throw new Error(
      'SSR is not currently supported for Angular Rspack Module Federation. Please use webpack instead.'
    );
  }
}
