import stylistic from "@stylistic/eslint-plugin";
import antiTrojanSource from "eslint-plugin-anti-trojan-source";
import globals from "globals";
import github from 'eslint-plugin-github';

export default [
    {
        ignores: ["**/dist/", "**/lib/", "**/node_modules/", "eslint.config.mjs"],
    },
    github.getFlatConfigs().recommended,
    {
        plugins: {
            "@stylistic": stylistic,
            "anti-trojan-source": antiTrojanSource,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            "@stylistic/function-call-spacing": ["error", "never"],
            "@stylistic/semi": ["error", "never"],
            "anti-trojan-source/no-bidi": "error",
            camelcase: "off",
            "eslint-comments/no-use": "off",
            "github/filenames-match-regex": ["error", "^[a-z_]+([.-][a-z_]+)*(\\.test|\\.d)?$"],
            "i18n-text/no-en": "off",
            "import/extensions": "off",
            "import/no-namespace": "off",
            "import/no-unresolved": "off",
            "no-unused-vars": "off",
            semi: "off",
        },
    }
];
