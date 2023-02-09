'use strict';

const config = {
    packageManager: 'npm',
    reporters: ['html', 'progress'],
    testRunner: 'mocha',
    coverageAnalysis: 'perTest',
    mochaOptions: {
        spec: ['test/unit/**/*.js']
    },
    ignoreStatic: true
};

try {
    const badgeReporterPath = require.resolve('stryker-mutator-badge-reporter');
    config.plugins = ['@stryker-mutator/*', badgeReporterPath];
    config.reporters.push('badge');
    config.badgeReporter = {
        label: 'mutation'
    };
} catch (e) {
    // ignore failure
}

module.exports = config;
