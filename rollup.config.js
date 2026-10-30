import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

import serve from 'rollup-plugin-serve';
import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';

import { less } from 'svelte-preprocess-less';
import sveltePreprocess from 'svelte-preprocess';

import { transformCodeToESMPlugin, keyPEM, certificatePEM } from '@windycom/plugin-devtools';

const useSourceMaps = true;

const buildConfigurations = {
    src: {
        input: 'src/plugin.svelte',
        out: 'plugin',
    },
};

const requiredConfig = process.env.CONFIG || 'src';
const { input, out } = buildConfigurations[requiredConfig];

export default {
    input,
    output: [
        {
            file: `dist/${out}.js`,
            format: 'module',
            sourcemap: true,
        },
        {
            file: `dist/${out}.min.js`,
            format: 'module',
            plugins: [
                // smaller plugin.min.js: two compress passes, modern syntax, mangle top-level names
                terser({ module: true, ecma: 2020, compress: { passes: 2, pure_getters: true }, mangle: { toplevel: true }, format: { comments: false } }),
            ],
        },
    ],

    onwarn: (warning, warn) => {
        // Host-specific accessibility is checked separately by svelte-check; retain all other diagnostics.
        if (warning.code === 'a11y-no-static-element-interactions') {return;}
        warn(warning);
    },
    external: id => id.startsWith('@windy/'),
    watch: {
        include: ['src/**'],
        exclude: 'node_modules/**',
        clearScreen: false,
    },
    plugins: [
        // npm start (served to Windy's developer mode): read the sample race from this computer (src/lib/source.ts)
        {
            name: 'racetrack-dev-flag',
            transform(code, id) {
                if (!id.endsWith('/src/lib/source.ts')) {return null;}
                return { code: code.replace("'__RACETRACK_DEV__'", process.env.SERVE !== 'false' ? "'true'" : "'false'"), map: null };
            },
        },
        rollupSvelte({
            emitCss: false,
            preprocess: {
                style: less({
                    sourceMap: false,
                    math: 'always',
                }),
                script: data => {
                    const preprocessed = sveltePreprocess({ sourceMap: useSourceMaps });
                    return preprocessed.script(data);
                },
            },
        }),
        rollupSwc({
            include: ['**/*.ts', '**/*.svelte'],
            sourceMaps: useSourceMaps,
        }),
        resolve({
            browser: true,
            mainFields: ['module', 'jsnext:main', 'main'],
            preferBuiltins: false,
            dedupe: ['svelte'],
        }),
        commonjs(),
        transformCodeToESMPlugin(),
        process.env.SERVE !== 'false' &&
            serve({
                // the plugin from dist/, and data/sample/ for the sample race
                contentBase: ['dist', '.'],
                host: '0.0.0.0',
                port: 9999,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                https: {
                    key: keyPEM,
                    cert: certificatePEM,
                },
            }),
    ],
};
