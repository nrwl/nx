import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
    { ignores: ["dist/**", "node_modules/**", "vite.config.mts"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...vue.configs["flat/recommended"],
    {
        files: ["**/*.vue"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,
                sourceType: "module",
            }
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        rules: {
            "vue/multi-word-component-names": "off",
        }
    }
];
