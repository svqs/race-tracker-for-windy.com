<!-- Who we follow and the three numbers that matter in this phase of the race -->
<div class="who">
    {@html avatarHtml(race.athlete.name, photo, 'panel')}
    <span class="who-t">
        <b class="name"><span class="nm">{ race.athlete.name }</span>{@html flagHtml(race.athlete.flag, 13)}{#if rank}<span class="rank" title={ fill($words.rankTitle, rank) }>{ fill($words.rank, rank) }</span>{/if}</b>
        <small>{ [race.athlete.boat, race.athlete.boatName, race.race.short].filter(Boolean).join(' · ') }</small>
    </span>
</div>
<div class="stats">
    {#if st.phase === 'before'}
        <div><span class="lbl">{ $words.statStartsIn }</span><span class="big num">{ countdown }</span></div>
        <div><span class="lbl">{ $words.statDistance }</span><span class="big num">{ fmtDist(st.toFinish, u.dist) } <small>{ distLabel(u.dist) }</small></span></div>
        <div><span class="lbl">{ $words.statStart }</span><span class="big num">{ startClock }</span></div>
    {:else if st.phase === 'racing'}
        <div><span class="lbl">{ $words.statSpeed }</span><span class="big num">{ fmtSpeed(st.speed, u.wind) } <small>{ windLabel(speedUnit(u.wind)) }</small></span></div>
        <div><span class="lbl">{ $words.statToFinish }</span><span class="big num">{ fmtDist(st.toFinish, u.dist) } <small>{ distLabel(u.dist) }</small></span></div>
        <div><span class="lbl">{ $words.statAtSea }</span><span class="big num">{ days(st.elapsed) }</span></div>
    {:else}
        <div><span class="lbl">{ $words.statTime }</span><span class="big num">{ days(st.elapsed) }</span></div>
        <div><span class="lbl">{ $words.statSailed }</span><span class="big num">{ fmtDist(st.sailed, u.dist) } <small>{ distLabel(u.dist) }</small></span></div>
        <div><span class="lbl">{ $words.statAverage }</span><span class="big num">{ fmtSpeed(st.average, u.wind) } <small>{ windLabel(speedUnit(u.wind)) }</small></span></div>
    {/if}
</div>

<script lang="ts">
    import { words, fill, nth } from '../lib/copy';
    import { avatarHtml, flagHtml } from '../lib/athlete';
    import { fmtDist, distLabel, fmtSpeed, windLabel, speedUnit } from '../lib/units';
    import type { RaceInfo, Settings } from '../lib/types';
    import type { RaceState } from '../lib/race';

    export let race: RaceInfo;
    export let st: RaceState;
    export let u: Settings;
    export let photo = '';
    export let countdown = '';
    export let startClock = '';

    /** the rank in the class, only while racing (the organisers' report, data/ranking.json) */
    $: rank = race.ranking && st.phase === 'racing' ? { nth: nth(race.ranking.rank), of: race.ranking.of, class: race.ranking.class || race.athlete.boat } : null;

    /** "4 d 6 h" or, in the first day, "14 h" */
    function days(ms: number): string {
        const h = Math.floor(ms / 3600e3);
        return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h`;
    }
</script>

<style lang="less">
    .who { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .who-t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { display: flex; flex-wrap: wrap; row-gap: 4px; align-items: center; gap: 8px; font-size: var(--rt-titleSize, 17px); font-weight: 600; min-width: 0;
        .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
    .rank { flex: none; padding: 3px 8px; border-radius: 9px; background: var(--rt-rankBg); border: 1px solid var(--rt-rankLine); color: var(--rt-rankText);
        font-size: 11.5px; font-weight: 600; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
    small { color: var(--rt-uSub, #b0b0b0); font-size: 12px; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; } }
    .lbl { font-size: 12px; color: var(--rt-uSub, #b0b0b0); white-space: nowrap; }
    .big { font-family: inherit; font-weight: 400; font-size: 22px; line-height: 1; white-space: nowrap; small { font-size: 12px; } }
    @media (max-width: 380px) { .big { font-size: 19px; } }
</style>
