export default function tailwindPlugin() {
  return {
    name: 'tailwind-plugin',
    configurePostCss(postcssOptions) {
      postcssOptions.plugins = [require('tailwindcss')];
      return postcssOptions;
    },
  };
}
