import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: "type:feature",
              onlyDependOnLibsWithTags: ["type:feature", "type:ui"]
            },
            {
              sourceTag: "type:ui",
              onlyDependOnLibsWithTags: ["type:ui"]
            },
            {
              sourceTag: "scope:orders",
              onlyDependOnLibsWithTags: [
                "scope:orders",
                "scope:products",
                "scope:shared"
              ]
            },
            {
              sourceTag: "scope:products",
              onlyDependOnLibsWithTags: ["scope:products", "scope:shared"]
            },
            {
              sourceTag: "scope:shared",
              onlyDependOnLibsWithTags: ["scope:shared"]
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
