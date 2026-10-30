<!-- Conditions where the boat is, right now: three numbers side by side, each with a small label above (Windy's dark content colours) -->
<div class="cond">
    <span class="c-title">{ title }</span>
    {#if loading && !now}
        <p class="c-empty">{ $words.fcLoading }</p>
    {:else if !now}
        <p class="c-empty">{ $words.fcEmpty }</p>
    {:else}
        <div class="c-three">
            <div><span class="c-lbl">{ $words.fcWind }</span><b class="num">{ fmtWind0(now.wind, u.wind) }<small>{ windLabel(u.wind) }</small></b></div>
            <div><span class="c-lbl">{ $words.fcGusts }</span><b class="num">{ fmtWind0(now.gust, u.wind) }<small>{ windLabel(u.wind) }</small></b></div>
            <div><span class="c-lbl">{ $words.fcWaves }</span><b class="num">{ now.waves === null ? '–' : fmtHeight(now.waves, u.height) }{#if now.waves !== null}<small>{ u.height }</small>{/if}</b></div>
        </div>
    {/if}
</div>

<script lang="ts">
    import { fmtWind0, fmtHeight, windLabel } from '../lib/units';
    import { words } from '../lib/copy';
    import type { Hour, Settings } from '../lib/types';

    export let title = '';
    export let now: Hour | null = null;
    export let loading = false;
    export let u: Settings;
</script>

<style lang="less">
    .cond { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: var(--rt-radiusCard, 18px); background: var(--rt-condBg, #4d4d4d); color: var(--rt-condText, #e5e5e5); }
    .c-title { font-size: 13px; font-weight: 600; color: var(--rt-condSub, rgba(229, 229, 229, 0.62)); }
    .c-empty { margin: 0; color: var(--rt-condSub, rgba(229, 229, 229, 0.62)); font-size: 13px; }
    .c-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;
        > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; } }
    .c-lbl { font-size: 12px; color: var(--rt-condSub, rgba(229, 229, 229, 0.62)); white-space: nowrap; }
    b { font-size: 22px; font-weight: 400; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums;
        small { margin-left: 3px; font-size: 12px; color: var(--rt-condSub, rgba(229, 229, 229, 0.62)); } }
</style>
