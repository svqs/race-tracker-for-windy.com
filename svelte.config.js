// For editor tools (VS Code's Svelte extension, svelte-check): read <script lang="ts"> and <style lang="less"> like the build does.
// The build itself sets its own preprocessing in rollup.config.js.
import sveltePreprocess from 'svelte-preprocess';

export default { preprocess: sveltePreprocess() };
