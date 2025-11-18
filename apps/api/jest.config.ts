import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    moduleFileExtensions: ['ts', 'js', 'json'],
    testRegex: '.*\\.spec\\.ts$',
    transform: { '^.+\\.(t|j)s$': 'ts-jest' },
    // Si tu es en ESM (package.json avec "type":"module"), décommente les 2 lignes ci-dessous :
    // extensionsToTreatAsESM: ['.ts'],
    // transform: { '^.+\\.(t|j)s$': ['ts-jest', { useESM: true }] },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1', // aide si tes imports TS finissent en .js
    },
};

export default config;
