module.exports = {
	preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
	moduleFileExtensions: [
"js", "jsx", "ts", "tsx", "json", "vue"
],
	transform: {
		"^.+\\.vue$": "@vue/vue2-jest",
		".+\\.(css|styl|less|sass|scss|svg|png|jpg|ttf|woff|woff2)$": "jest-transform-stub",
		"^.+\\.tsx?$": "ts-jest",
		"^.+\\.jsx?$": "babel-jest",
	},
	transformIgnorePatterns: [
		// '/node_modules/',
		"!/(common|src)/",
		"/tests/unit/server/",
	],
	rootDir: "../..",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^common/(.*)$": "<rootDir>/../common/$1",
	},
	snapshotSerializers: ["jest-serializer-vue"],
	testMatch: ["**/tests/unit/**/*.spec.(js|jsx|ts|tsx)|**/__tests__/*.(js|jsx|ts|tsx)"],
	testURL: "http://localhost/",
	watchPlugins: ["jest-watch-typeahead/filename", "jest-watch-typeahead/testname"],
	collectCoverage: true,
	coverageReporters: [
"text-summary", "text", "json", "html"
],
	collectCoverageFrom: [
		"**/*.{js,jsx,ts,tsx,vue}",
		"!**/node_modules/**",
		"!**/dist/**",
		"!**/*.config.js",
		"!**/*.eslintrc.js",
		"!**/coverage/**",
		"!**/tests/**",
		"!src/App.vue",
		"!src/plugins/vuetify.js",
		"!src/(main|router).js",
		"!*.js",
		"!src/components/players/**", // Ignore players because coverage for these is not really useful signal, and it's really hard to write unit tests for them. Better to write e2e integration tests for them.
	],
};
