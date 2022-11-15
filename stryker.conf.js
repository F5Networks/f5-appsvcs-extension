'use strict';

const reporters = ['html', 'progress'];
let badgeReporter;
let plugins;

try {
    const badgeReporterPath = require.resolve('stryker-mutator-badge-reporter');
    plugins = ['@stryker-mutator/*', badgeReporterPath];
    reporters.push('badge');
    badgeReporter = {
        label: 'mutation'
    };
} catch (e) {
    // ignore failure
}

module.exports = {
    packageManager: 'npm',
    plugins,
    reporters,
    badgeReporter,
    testRunner: 'mocha',
    coverageAnalysis: 'perTest',
    mochaOptions: {
        spec: ['test/unit/**/*.js']
    },
    ignoreStatic: true
};
