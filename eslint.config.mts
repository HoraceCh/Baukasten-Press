import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'.npm-cache/',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json', 'scripts/validate-agent-infrastructure.mjs', 'scripts/validate-environment.mjs', 'scripts/run-contract-tests.mjs', 'tests/environment-contract.test.mjs', 'tests/run-contract-tests.test.mjs'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['scripts/validate-agent-infrastructure.mjs', 'scripts/validate-environment.mjs', 'scripts/run-contract-tests.mjs', 'tests/environment-contract.test.mjs', 'tests/run-contract-tests.test.mjs'],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
		},
	},
	{
		files: ['scripts/validate-agent-infrastructure.mjs'],
		rules: {
			'no-console': 'off',
			'obsidianmd/rule-custom-message': 'off',
		},
	},
	{
		files: ['tests/publication-domain-contract.test.ts', 'tests/publication-state-machine.test.ts', 'tests/integration-contracts.test.ts'],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				projectService: false,
			},
		},
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/hardcoded-config-path': 'off',
			'obsidianmd/no-plugin-as-component': 'off',
			'obsidianmd/no-view-references-in-plugin': 'off',
			'obsidianmd/no-unsupported-api': 'off',
			'obsidianmd/prefer-create-el': 'off',
			'obsidianmd/prefer-file-manager-trash-file': 'off',
			'obsidianmd/prefer-instanceof': 'off',
		},
	},
);
