export default [
  {
    plugins: {
      get ['@nx']() {
        return require('../index');
      },
    },
    ignores: ['.nx'],
  },
];
