import tseslint from 'typescript-eslint'
import love from 'eslint-config-love'
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    {
        ignores: ["**/dist", "**/node_modules", "**/*.mjs"],
    },
    love,
    eslintConfigPrettier,
    eslintPluginPrettierRecommended,
    tseslint.config({
        extends: [tseslint.configs.recommendedTypeChecked],

        files: [
            'client/**/*.ts',
        ],
        rules: {
            "@typescript-eslint/no-unused-vars": [2, {
                argsIgnorePattern: "^_",
            }],

            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/strict-boolean-expressions": "off",
            "@typescript-eslint/return-await": [2, "in-try-catch"],
            "@typescript-eslint/no-invalid-void-type": "off",
            "@typescript-eslint/triple-slash-reference": "off",
            "@typescript-eslint/class-methods-use-this": "off",
            "@typescript-eslint/no-magic-numbers": "off",
            "@typescript-eslint/no-unsafe-type-assertion": "off",
            "@typescript-eslint/prefer-destructuring": "off",
            "eslint-comments/require-description": "off",
            "@typescript-eslint/no-loop-func": "off",

            semi: ['error', 'never'], // Enforce no semicolons
            'prettier/prettier': ['error', { semi: false }], // Ensure Prettier also enforces it

            "no-lone-blocks": "off",

            "max-len": ["error", {
                code: 120,
                comments: 120,
            }],

            "no-unused-vars": "off",
        }
    })
)
