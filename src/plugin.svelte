<div class="plugin__mobile-header">
    { title }
</div>
<!-- the swipe handlers keep scrolling inside the panel (Windy would move its pane otherwise) -->
<section aria-label={ W.wordmark } class="plugin__content racetrack" class:m={ isMobile } class:bar={ barMode } class:has-bg={ !!bgPhoto } style={ bgPhoto ? `--rt-bgimg: url("${bgPhoto.replace(/["\\]/g, '')}")` : '' } bind:this={ root } on:touchstart={ touchStart } on:touchmove={ touchMove }>

{#if barMode}
<!-- ================= PHONE: a compact bar in Windy's pane; pages open in a panel that rises over the map (like spotlog) ================= -->
    <div class="mbar">
        <div class="mrow">
            <span class="brand"><span class="wordmark">{ W.wordmark }</span><span class="tag" class:live={ phase === 'racing' }>{ phaseTag }</span></span>
        </div>
        <!-- one row: each button opens its page in the panel and moves the map (Find: the boat, Whole race: the race) -->
        <div class="macts">
            {#each NAV as [k, icon] (k)}
                <button class="mact" class:on={ modalOpen && tab === k } disabled={ !race } on:click={ () => go(k) }><Icon name={ icon } size={ 18 } /><span>{ navLabel(k, W, phase, race) }</span></button>
            {/each}
        </div>
    </div>
{/if}
<div class="mwrap" bind:this={ mwrapEl } class:on={ barMode } class:open={ modalOpen }>
<div class="body" bind:this={ bodyEl }>

<!-- ================= HEADER ================= -->
{#if barMode}
    <div class="topbar">
        <span class="grow"><b class="title">{ race ? fill(W[TAB_TITLE[tab]], { short: race.athlete.short }) : W[TAB_TITLE[tab]] }</b></span>
        <button class="mclose" aria-label={ W.close } on:click={ closeModal }>✕</button>
    </div>
{:else}
    <!-- the top card: the boat's photo (race.json: athlete.cover) fills it; the logo row and Milan's numbers sit on dark glass -->
    <div class="card head" class:photo={ !!cover } style={ cover ? `--rt-img: url("${cover.replace(/["\\]/g, '')}")` : '' }>
        <div class="row head-top">
            <button class="back-menu" aria-label={ W.windyMenu } title={ W.windyMenu } on:click={ toWindyMenu }>
                <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true"><polyline points="11,3 3,11 11,19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <span class="brand grow-b"><span class="wordmark">{ W.wordmark }</span><span class="tag" class:live={ phase === 'racing' }>{ phaseTag }</span></span>
        </div>
        {#if cover}<div class="head-gap"></div>{/if}
        {#if race && st}<div class="head-who"><Stats { race } { st } { photo } u={ S } countdown={ countdown } startClock={ startClock } /></div>{/if}
    </div>
{/if}

{#if !race}
<!-- ================= LOADING / NOTHING YET ================= -->
    <div class="card">
        {#if loading}
            <p class="p muted">{ W.loading }</p>
        {:else}
            <p class="p err">{ W.loadErrorEmpty }</p>
            <button class="btn ghost wide" on:click={ () => refresh() }>{ W.retry }</button>
        {/if}
    </div>
{:else}
    {#if !barMode}
        <!-- one row: the three pages. Find also takes the map to the boat, Whole race shows the race -->
        <div class="actions">
            {#each NAV as [k, icon] (k)}
                <button class="act" class:on={ tab === k } aria-pressed={ tab === k } on:click={ () => go(k) }><Icon name={ icon } /><b>{ navLabel(k, W, phase, race) }</b></button>
            {/each}
        </div>
    {/if}

    {#if tab === 'now'}
<!-- ================= NOW ================= -->
        {#if barMode && st}<div class="card head" class:photo={ !!cover } style={ cover ? `--rt-img: url("${cover.replace(/["\\]/g, '')}")` : '' }>{#if cover}<div class="head-gap"></div>{/if}<div class="head-who"><Stats { race } { st } { photo } u={ S } countdown={ countdown } startClock={ startClock } /></div></div>{/if}

        {#if phase === 'before'}
            <div class="status-line wait"><i class="live-dot"></i><span>{ W.notStarted }</span></div>
            <div class="card status">
                <b class="h3">{ countdownTitle }</b>
                <small>{ fill(W.startsAt, { day: day(race.start.time), clock: clock(race.start.time), place: race.start.name }) }</small>
            </div>
        {:else if phase === 'finished' || phase === 'retired'}
            <div class="card status">
                <b class="h3">{ phase === 'finished' ? fill(W.finishedIn, { time: fmtDuration(st?.elapsed || 0) }) : W.retired }</b>
                {#if st?.last}<small>{ fill(W.lastPos, { ago: dayTime(st.last.t) }) }</small>{/if}
            </div>
        {:else if st?.last}
            <div class="status-line" class:quiet={ st.quiet }>
                <i class="live-dot"></i><span>{ fill(W.lastPos, { ago: ago(st.age || 0) }) }</span>
            </div>
        {:else}
            <!-- started, but no position from the tracker yet -->
            <div class="status-line wait"><i class="live-dot"></i><span>{ fill(W.noPosYet, { short: race.athlete.short }) }</span></div>
        {/if}

        <Conditions
            title={ phase === 'before' || !st?.last ? W.condTitleBefore : W.condTitle }
            now={ windNow } loading={ windLoading } u={ S }
            />

        <!-- the athlete's newest video (race.json "videos", or found by the update-track Action: data/videos.json); only when there is one -->
        {#if video && isMobile}
            <!-- phones: a link to the newest video on YouTube (in the playlist, so the next ones follow). YouTube's player
                 refuses to play inside some phone setups (Windy's app: error 153), so phones don't embed it (owner, 31 Oct) -->
            <a class="card vlink" href={ youtubeLink(video, race.playlist) } target="_blank" rel="noopener noreferrer">
                <span class="vthumb"><img src={ `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` } alt="" loading="lazy" referrerpolicy="no-referrer" on:error={ hideImg } /><span class="pbtn small"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="#fff" /></svg></span></span>
                <span class="grow"><b>{ W.videoWatch }</b><small>{ video.title || fill(W.videoUntitled, { short: race.athlete.short }) }</small></span>
                <span class="go" aria-hidden="true">↗</span>
            </a>
        {:else if video}
            <div class="card vid">
                <b>{ W.videoTitle }</b>
                <!-- an upright video (a Short) sits smaller on the left with its title beside it (owner, 2 Nov) -->
                <div class="vmain" class:tall={ video.vertical }>
                <div class="player" class:tall={ video.vertical }>
                    {#if playing === video.id}
                        <!-- YouTube's player, only once someone presses play (it starts straight away) -->
                        {#key video.id}
                            <iframe src={ `https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0&autoplay=1` } title={ video.title || fill(W.videoUntitled, { short: race.athlete.short }) }
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen
                                referrerpolicy="strict-origin-when-cross-origin"></iframe>
                        {/key}
                    {:else}
                        <!-- before that: the thumbnail and a play button (no YouTube title bar over the video) -->
                        <button class="poster" aria-label={ fill(W.videoPlay, { title: video.title || fill(W.videoUntitled, { short: race.athlete.short }) }) } on:click={ () => (playing = video?.id ?? '') }>
                            <img src={ `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` } alt="" loading="lazy" referrerpolicy="no-referrer" on:error={ hideImg } />
                            <span class="pbtn"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="#fff" /></svg></span>
                        </button>
                    {/if}
                </div>
                {#if video.title || video.date}<div class="vmeta">{#if video.title}<span class="vt">{ video.title }</span>{/if}{#if video.date}<small>{ dayTime(video.date) }</small>{/if}</div>{/if}
                </div>
                {#if earlier.length}
                    <!-- the ones before it: a short list with small thumbnails that scrolls inside the card, so the card
                         never grows (owner, 2 Nov); a tap plays it here instead -->
                    <small class="vh">{ W.videoEarlier }</small>
                    <div class="vlist">
                        {#each earlier as v (v.id)}
                            <button class="vitem" aria-label={ fill(W.videoPlay, { title: v.title || fill(W.videoUntitled, { short: race.athlete.short }) }) } on:click={ () => { videoId = v.id; playing = v.id; } }>
                                <img src={ `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` } alt="" loading="lazy" referrerpolicy="no-referrer" on:error={ hideImg } />
                                <span class="grow"><b>{ v.title || fill(W.videoUntitled, { short: race.athlete.short }) }</b>{#if v.date}<small>{ dayTime(v.date) }</small>{/if}</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Windy's own point forecast at the boat opens below the map (desktop: on its own, on the Wind tab). Here only
             when it isn't showing the boat: closed, or opened somewhere else -->
        {#if !isMobile && !(pfOpen && pfOurs)}
            <div class="card pf">
                <span class="pf-ic"><Icon name="weather" size={ 18 } /></span>
                <span class="grow"><b>{ W.pfTitle }</b><small>{ pfOpen ? W.pfElsewhere : fill(W.pfClosed, { short: race.athlete.short }) }</small></span>
                <button class="btn pf-btn" on:click={ () => openForecast() }>{ fill(W.pfBack, { short: race.athlete.short }) }</button>
            </div>
        {:else if isMobile}
            <!-- phones: Windy's forecast opens over the map -->
            <div class="card pf">
                <span class="pf-ic"><Icon name="weather" size={ 18 } /></span>
                <span class="grow"><b>{ W.pfTitle }</b><small>{ fill(phase === 'before' || !st?.last ? W.pfClosedBefore : W.pfClosed, { short: race.athlete.short }) }</small></span>
                <button class="btn pf-btn" on:click={ () => openForecast() }>{ W.pfShow }</button>
            </div>
        {/if}

        <!-- Things to look out for: Windy layers, one line each; a tap switches Windy's map to it -->
        <div class="card watch">
            <b>{ W.watchTitle }</b>
            <div class="wlist">
                {#each watch as x (x.layer)}
                    <button class="witem" class:on={ overlay === x.layer } aria-pressed={ overlay === x.layer } on:click={ () => showLayer(x.layer) }>
                        <span class="wtext"><b>{ layerName(x.layer) }</b><small>{ x.text }</small></span>
                        <span class="wstate">{ overlay === x.layer ? W.watchOn : W.watchShow }</span>
                    </button>
                {/each}
            </div>
        </div>

        {#if st?.last && phase !== 'before'}
            <!-- the boat's numbers, on a photo of the boat (race.json: athlete.boatPhoto), darkened so they stay readable -->
            <div class="card boatcard" class:photo={ !!boatPhoto } style={ boatPhoto ? `--rt-img: url("${boatPhoto.replace(/["\\]/g, '')}")` : '' }>
                <b>{ W.boatTitle }</b>
                <div class="kv">
                    {#if phase === 'racing'}
                        <span>{ W.boatSpeed }</span><b>{ fmtSpeed(st.speed, S.wind) } { windLabel(speedUnit(S.wind)) }</b>
                        <span>{ W.boatCourse }</span><b class="dirb">{#if st.course !== null}<i class="course" style="transform: rotate({ Math.round(st.course) }deg)">↑</i> { dirName(st.course) } { Math.round(st.course) }°{:else}–{/if}</b>
                    {/if}
                    <span>{ W.boatAverage }</span><b>{ fmtSpeed(st.average, S.wind) } { windLabel(speedUnit(S.wind)) }</b>
                    <span>{ W.boatSailed }</span><b>{ fmtDist(st.sailed, S.dist) } { distLabel(S.dist) }</b>
                    {#if phase !== 'finished'}<span>{ W.statToFinish }</span><b>{ fmtDist(st.toFinish, S.dist) } { distLabel(S.dist) } <small>{ W.straightLine }</small></b>{/if}
                    <span>{ W.boatPosition }</span><b class="pos">{ fmtPosition(st.last.lat, st.last.lon) }</b>
                </div>
            </div>
        {:else if phase === 'before'}
            <div class="card">
                <b>{ W.waitTitle }</b>
                <p class="p muted">{ fill(W.waitText, { short: race.athlete.short }) }</p>
            </div>
        {/if}
        {#if race.officialUrl}
            <!-- the whole fleet on the organisers' tracker: a quiet line at the very end, opens a new window (owner, 2 Nov) -->
            <a class="fleet" href={ race.officialUrl } target="_blank" rel="noopener noreferrer">{ race.officialName ? fill(W.fleetLink, { name: race.officialName }) : W.fleetLinkNoName }</a>
        {/if}

    {:else if tab === 'track'}
<!-- ================= TRACK ================= -->
        {#if !rows.length}
            <div class="empty">{ W.trackEmpty }</div>
        {:else}
            <small class="muted line">{ W.trackIntro }</small>
            <div class="card list-card">
                {#each shownGroups as g (g.key)}
                    <div class="dayh">{ g.label }</div>
                    {#each g.rows as r (r.p.t)}
                        <button class="item" class:on={ picked?.t === r.p.t } on:click={ () => pickPoint(r.p) }>
                            <span class="t num">{ clock(r.p.t) }</span>
                            <span class="grow"><b class="num">{ fmtSpeed(r.speed, S.wind) } <small>{ windLabel(speedUnit(S.wind)) }</small></b></span>
                            <span class="crs">{#if r.course !== null}<i class="course" style="transform: rotate({ Math.round(r.course) }deg)">↑</i><small>{ dirName(r.course) }</small>{/if}</span>
                            <span class="fin num">{ fmtDist(r.toFinish, S.dist) } <small>{ distLabel(S.dist) }</small></span>
                        </button>
                    {/each}
                {/each}
                {#if shown < rows.length}
                    <button class="link more" on:click={ () => (shown += PAGE) }>{ W.trackMore }</button>
                {:else}
                    <div class="item start-row"><span class="t">{ clock(race.start.time) }</span><span class="grow"><b>{ W.trackStart }</b> <small>{ race.start.name }</small></span></div>
                {/if}
            </div>
            {#if track?.updated}<small class="muted line">{ fill(W.trackUpdated, { time: dayTime(track.updated) }) }</small>{/if}
        {/if}

    {:else}
<!-- ================= FOLLOW: their social media, others to follow (Windy.com), the race website. Nothing else (owner's decision) ================= -->
        <div class="card about">
            <b class="h3">{ fill(W.followWho, { short: race.athlete.short }) }</b>
            {#if race.athlete.links.length}
                <div class="links">
                    {#each race.athlete.links as l (l.url)}<a class="lnk" href={ l.url } target="_blank" rel="noopener noreferrer">{ l.label || W.linkWebsite }<span aria-hidden="true">↗</span></a>{/each}
                </div>
            {:else}
                <small class="muted">{ W.followNone }</small>
            {/if}
        </div>
        {#each race.follow as f (f.name)}
            <div class="card about">
                <b class="h3">{ fill(W.followWho, { short: f.name }) }</b>
                <div class="links">
                    {#each f.links as l (l.url)}<a class="lnk" href={ l.url } target="_blank" rel="noopener noreferrer">{ l.label }<span aria-hidden="true">↗</span></a>{/each}
                </div>
            </div>
        {/each}
        {#if race.race.links.length}
            <div class="card about">
                <b class="h3">{ race.race.name }</b>
                <div class="links">
                    {#each race.race.links as l (l.url)}<a class="lnk" href={ l.url } target="_blank" rel="noopener noreferrer">{ l.label || W.linkRace }<span aria-hidden="true">↗</span></a>{/each}
                </div>
            </div>
        {/if}
        <div class="sig">
            <span class="ver">{@html rich(W.version, { version })}</span>
        </div>
    {/if}
{/if}

</div>
</div>
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import metrics from '@windy/metrics';
    import plugins from '@windy/plugins';
    import store from '@windy/store';
    import * as trans from '@windy/trans';
    import { map, centerMap } from '@windy/map';
    import * as rootScope from '@windy/rootScope';
    import { onDestroy, onMount, tick } from 'svelte';

    import config from './pluginConfig';
    import { LOGO_FONT_CSS } from './lib/logo-font';
    import { themeCss } from './lib/theme';
    import { words, fill, rich, nth, t as tr } from './lib/copy';
    import { defaultDataUrl, loadRace, lastLoaded } from './lib/source';
    import { trackUrl } from './lib/data';
    import { raceState, motion, thinned, fmtDuration } from './lib/race';
    import { hoursAt } from './lib/forecast';
    import { distanceKm, dirName, fmtPosition } from './lib/geo';
    import { fromWindy, fmtSpeed, fmtDist, distLabel, windLabel, speedUnit } from './lib/units';
    import { createRaceLayer } from './lib/map/race';
    import { watchList, layerName } from './lib/layers';

    import Stats from './ui/Stats.svelte';
    import Conditions from './ui/Conditions.svelte';
    import Icon from './ui/Icon.svelte';

    import type { Loaded } from './lib/source';
    import type { Settings as SettingsT, TrackPoint, Hour, RaceInfo, LayerId, Watch } from './lib/types';

    type Tab = 'now' | 'track' | 'about';
    const TAB_TITLE: Record<Tab, string> = { now: 'titleNow', track: 'titleTrack', about: 'titleAbout' };
    const PAGE = 48;
    /** phones: how close Find Milan zooms in at most */
    const PHONE_ZOOM = 7;
    const REFRESH = 5 * 60e3;

    const { title, version } = config;
    const isMobile = !!rootScope?.isMobileOrTablet;

    let root: HTMLElement;
    let bodyEl: HTMLElement;

    /* ---------- wording ---------- */
    $: W = $words;

    /* ---------- units: the viewer's own Windy units (Windy's settings), nothing to pick in racetrack ---------- */
    const windyUnits = (): SettingsT => {
        try {
            return fromWindy(metrics as unknown as Parameters<typeof fromWindy>[0]);
        } catch {
            return fromWindy({});
        }
    };
    let S: SettingsT = windyUnits();

    /* ---------- the race data (from GitHub; the last copy first, so something shows straight away) ---------- */
    let loaded: Loaded | null = lastLoaded();
    let loading = false;
    let loadedAt = loaded?.at || 0;
    let abort: AbortController | null = null;
    async function refresh() {
        abort?.abort();
        const a = new AbortController();
        abort = a;
        loading = true;
        try {
            const l = await loadRace(dataUrl(), a.signal);
            if (abort !== a) {return;}
            loaded = l;
            loadedAt = l.at;
        } catch (e) {
            if (abort !== a) {return;}
            console.info('[racetrack] could not load the race', e);
        } finally {
            if (abort === a) {loading = false;}
        }
    }
    // the sandbox and the scenario tests (they set window.__racetrackDataUrl) can ask for fresh data straight away
    onMount(() => {
        const w = window as unknown as { __racetrackDataUrl?: string; __racetrackRefresh?: () => Promise<void> };
        if (w.__racetrackDataUrl) {w.__racetrackRefresh = refresh;}
    });
    /** the sandbox page can point racetrack at local test files */
    const dataUrl = (): string => {
        const o = (window as unknown as { __racetrackDataUrl?: string }).__racetrackDataUrl;
        return typeof o === 'string' && o ? o : defaultDataUrl();
    };

    /* ---------- the clock (for "12 min ago" and the countdown) ---------- */
    let now = Date.now();

    $: race = loaded?.race ?? null;
    $: track = loaded?.track ?? null;
    $: st = race && track ? raceState(race, track, now) : null;
    $: phase = st?.phase ?? 'before';
    $: phaseTag = phase === 'racing' ? W.tagLive : phase === 'before' ? W.tagSoon : phase === 'finished' ? W.tagFinished : W.tagRetired;
    $: countdown = race ? countdownText(race.start.time - now) : '';
    $: countdownTitle = race && race.start.time - now > 60e3 ? fill(W.startsIn, { time: countdownText(race.start.time - now) }) : W.startsNow;
    $: startClock = race ? new Date(race.start.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    /** the athlete's photo: a file next to race.json, or a full address */
    $: photo = race?.athlete.photo ? trackUrl(dataUrl(), race.athlete.photo) : '';
    /** photos of the boat (race.json), each optional: background behind the whole panel, cover fills the top card, boatPhoto behind "The boat" */
    $: bgPhoto = race?.athlete.background ? trackUrl(dataUrl(), race.athlete.background) : '';
    $: cover = race?.athlete.cover ? trackUrl(dataUrl(), race.athlete.cover) : '';
    $: boatPhoto = race?.athlete.boatPhoto ? trackUrl(dataUrl(), race.athlete.boatPhoto) : '';
    /** where the boat is (before the start: the start) */
    $: here = st?.last ?? race?.start ?? null;

    function countdownText(ms: number): string {
        if (ms <= 0) {return '0 h';}
        const h = Math.floor(ms / 3600e3);
        const d = Math.floor(h / 24);
        return d > 0 ? `${d} d ${h % 24} h` : h > 0 ? `${h} h ${Math.floor((ms % 3600e3) / 60e3)} min` : `${Math.max(1, Math.floor(ms / 60e3))} min`;
    }
    const clock = (ts: number): string => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const day = (ts: number): string => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const dayTime = (ts: number): string => `${day(ts)}, ${clock(ts)}`;
    function ago(ms: number): string {
        const m = Math.floor(ms / 60e3);
        if (m < 2) {return W.agoNow;}
        if (m < 60) {return fill(W.agoMin, { n: m });}
        if (m < 180) {return fill(W.agoHM, { h: Math.floor(m / 60), m: m % 60 });}
        if (m < 48 * 60) {return fill(W.agoH, { n: Math.floor(m / 60) });}
        return fill(W.agoD, { n: Math.floor(m / 1440) });
    }

    /* ---------- Windy's forecast where the boat is ---------- */
    let windNow: Hour | null = null;
    let windLoading = false;
    let windKey = '';
    $: if (here) {loadWind(here.lat, here.lon);}
    async function loadWind(lat: number, lon: number) {
        // a new forecast when the boat has a new position, or every 20 minutes
        const key = `${lat.toFixed(3)},${lon.toFixed(3)},${Math.floor(Date.now() / 1200e3)}`;
        if (key === windKey) {return;}
        windKey = key;
        windLoading = true;
        const hours = await hoursAt(lat, lon, Date.now(), 0, 1);
        if (windKey !== key || destroyed) {return;}
        windNow = hours[0] ?? null;
        windLoading = false;
    }

    /* ---------- the track list ---------- */
    let shown = PAGE;
    let picked: TrackPoint | null = null;
    // the video card on Find Milan's page: the newest video, or the one picked from the earlier ones
    let videoId = '';
    /** the video whose YouTube player is on (pressed play); none when the page changes, so it never starts by itself */
    let playing = '';
    /** a video on YouTube: a Short as a Short; otherwise in the playlist (if there is one) so the next ones follow */
    const youtubeLink = (v: { id: string; vertical: boolean }, playlist: string): string =>
        v.vertical ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}${playlist ? `&list=${playlist}` : ''}`;
    /** a thumbnail that doesn't load: nothing (not the browser's broken-picture mark) */
    const hideImg = (e: Event) => { (e.currentTarget as HTMLElement).style.opacity = '0'; };
    $: video = race?.videos.find(v => v.id === videoId) ?? race?.videos[0] ?? null;
    $: earlier = race && video ? race.videos.filter(v => v.id !== video?.id) : [];

    // the race's positions only: from the start, like the official tracker (nothing earlier)
    $: racePts = race && track ? track.points.filter(p => p.t >= race.start.time) : [];
    $: rows = race ? thinned(racePts, 60).map(({ p, i }) => ({ p, ...motion(racePts, i), toFinish: distanceKm(p, race.finish) })) : [];
    $: shownGroups = groupByDay(rows.slice(0, shown));
    function groupByDay<T extends { p: TrackPoint }>(list: T[]): { key: string; label: string; rows: T[] }[] {
        const out: { key: string; label: string; rows: T[] }[] = [];
        for (const r of list) {
            const key = new Date(r.p.t).toDateString();
            const g = out[out.length - 1];
            if (g && g.key === key) {g.rows.push(r);}
            else {out.push({ key, label: new Date(r.p.t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), rows: [r] });}
        }
        return out;
    }
    /** A position from the list goes on the map (phones: the panel steps aside) */
    function pickPoint(p: TrackPoint) {
        picked = picked?.t === p.t ? null : p;
        raceLayer.pick(picked ? { p: picked, label: dayTime(picked.t) } : null);
        if (!picked) {return;}
        if (barMode) {modalOpen = false;}
        try {
            centerMap({ lat: p.lat, lon: p.lon, zoom: Math.max(currentZoom(), 6) });
        } catch {
            /* the map keeps its place */
        }
    }

    /* ---------- tabs ---------- */
    let tab: Tab = 'now';
    function setTab(k: Tab) {
        tab = k;
        playing = '';
        tick().then(scrollTop);
        if (k === 'now') {autoForecast();}
    }

    /* ---------- phones: compact bar + a panel that rises over the map (the same as spotlog) ---------- */
    let modalOpen = false;
    /** set when this phone clips the panel (it would be invisible): then the classic half-screen panel is used */
    let modalFallback = false;
    $: barMode = isMobile && !modalFallback;
    function openModal() {
        if (!barMode) {return;}
        modalOpen = true;
        tick().then(() => setTimeout(checkModalVisible, 80));
    }
    /** Windy's pane could cut off anything above it: check the panel really shows, else fall back */
    function checkModalVisible() {
        if (!modalOpen || !bodyEl) {return;}
        try {
            const r = bodyEl.getBoundingClientRect();
            const pts = [[0.5, 30], [0.2, r.height / 2], [0.8, r.height - 30]];
            const seen = pts.some(([fx, dy]) => {
                const hit = document.elementFromPoint(r.left + r.width * fx, Math.max(r.top + dy, 2));
                return !!hit && root.contains(hit);
            });
            if (r.height < 60 || !seen) {
                modalFallback = true;
                modalOpen = false;
                showPhoneError('the panel over the map is cut off on this phone, using the panel under the timeline instead');
            }
        } catch {
            /* keep going */
        }
    }
    function closeModal() {
        modalOpen = false;
    }
    function scrollTop() {
        if (bodyEl && bodyEl.scrollTop > 0) {bodyEl.scrollTop = 0;}
        let el: HTMLElement | null = root;
        while (el) {
            if (el.scrollTop > 0) {el.scrollTop = 0;}
            el = el.parentElement;
        }
    }
    let touchY = 0;
    let touchX = 0;
    function touchStart(e: TouchEvent) {
        touchY = e.touches[0]?.clientY ?? 0;
        touchX = e.touches[0]?.clientX ?? 0;
    }
    function touchMove(e: TouchEvent) {
        const y = e.touches[0]?.clientY ?? 0;
        const dy = touchY - y;
        // sideways moves stay inside racetrack: the panel doesn't slide around
        if (Math.abs((e.touches[0]?.clientX ?? 0) - touchX) > Math.abs(dy)) {
            e.stopPropagation();
            return;
        }
        let el = e.target as HTMLElement | null;
        while (el && el !== root && !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY))) {el = el.parentElement;}
        const box = el || root;
        const canScroll = dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
        if (canScroll) {e.stopPropagation();}
    }
    function toWindyMenu() {
        try {
            bcast.emit('rqstOpen', 'menu');
        } catch (e) {
            console.info('[racetrack] could not open the Windy menu', e);
        }
    }

    /*
     * Phones: errors are invisible there (no console), so racetrack shows its own errors in a small box at the top.
     * Only errors from racetrack's code, not Windy's.
     */
    let errBox: HTMLElement | null = null;
    function showPhoneError(msg: string) {
        if (!isMobile) {return;}
        try {
            if (!errBox) {
                errBox = document.createElement('div');
                errBox.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));z-index:3000;padding:10px 12px;border-radius:12px;background:#5a1f24;color:#fff;font:12px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)';
                errBox.addEventListener('click', () => { errBox?.remove(); errBox = null; });
                document.body.appendChild(errBox);
            }
            errBox.textContent = tr('phoneProblem', { version, message: msg });
        } catch {
            /* nothing more we can do */
        }
    }
    const fromUs = (stack: string, file: string) => /plugin(\.min)?\.js|racetrack/i.test(file + ' ' + stack);
    const onWinError = (e: ErrorEvent) => {
        if (fromUs(String(e.error?.stack || ''), e.filename || '')) {showPhoneError(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);}
    };
    const onRejection = (e: PromiseRejectionEvent) => {
        const r = e.reason as Error | undefined;
        if (r && fromUs(String(r.stack || ''), '')) {showPhoneError(String(r.message || r));}
    };
    if (isMobile) {
        window.addEventListener('error', onWinError);
        window.addEventListener('unhandledrejection', onRejection);
    }

    /* ---------- map ---------- */
    let destroyed = false;
    let mapReady = false;
    const raceLayer = createRaceLayer({
        line: (points, o) => L.polyline(points, { color: o.color, weight: o.weight, opacity: o.opacity, dashArray: o.dashArray, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map),
        point: (lat, lon, html, o) => {
            const m = new L.Marker({ lat, lng: lon }, {
                icon: L.divIcon({ className: 'rt-marker', html, iconSize: [0, 0], iconAnchor: [0, 0] }),
                interactive: !!o?.click, keyboard: false, ...(o?.front ? { zIndexOffset: 1000 } : {}),
            } as L.MarkerOptions).addTo(map);
            if (o?.click) {m.on('click', o.click);}
            return m;
        },
        fit: pts => {
            map.fitBounds?.(pts as L.LatLngBoundsExpression, {
                paddingTopLeft: [40, 70],
                paddingBottomRight: isMobile ? [40, coveredBelow()] : [470, 80],
                maxZoom: 9,
            });
        },
    });
    function currentZoom(): number {
        try {
            return map?.getZoom?.() ?? 5;
        } catch {
            return 5;
        }
    }
    function view() {
        if (!race || !track || !st) {return null;}
        // the track from the start (like the official tracker); before it, only the boat where it is now
        const pts = track.points.filter(p => p.t >= race.start.time);
        return {
            race, points: pts, picked: picked ? { p: picked, label: dayTime(picked.t) } : null,
            // before the start: where the boat is now (no speed, no track), grey once it's been 3 hours without a position
            boat: st.last ? { p: st.last, course: st.course, label: st.phase === 'racing' ? `${fmtSpeed(st.speed, S.wind)} ${windLabel(speedUnit(S.wind))}` : '', quiet: st.quiet || (st.phase !== 'racing' && st.phase !== 'before'), photo, rank: st.phase === 'racing' && race.ranking ? nth(race.ranking.rank) : '', small: isMobile } : null,
            courseFrom: st.phase === 'before' ? race.start : undefined,
            showCourse: st.phase === 'before' || st.phase === 'racing',
            onBoat: () => boatTapped(),
        };
    }
    function drawRace() {
        if (!mapReady || typeof L === 'undefined' || !map) {return;}
        const v = view();
        if (v) {raceLayer.draw(v);}
    }
    // redraw when new positions arrive or the units change (the boat's label shows its speed)
    $: if (mapReady && loaded && S) {drawRace();}

    /**
     * The three buttons (one row, desktop and phones). Each opens its page; Find also takes the map to the boat and
     * Whole race shows the race. Phones: the page rises in the panel and the map moves above it.
     */
    const NAV: [Tab, 'boat' | 'route' | 'person'][] = [['now', 'boat'], ['track', 'route'], ['about', 'person']];
    const navLabel = (k: Tab, w: Record<string, string>, ph: string, r: RaceInfo | null): string =>
        k === 'now' ? fill(w.actFind, { short: r?.athlete.short ?? '' })
            : k === 'track' ? (ph === 'before' ? w.actWholeBefore : w.actWhole)
                : fill(w.actAbout, { short: r?.athlete.short ?? '' });
    function go(k: Tab) {
        if (!race) {return;}
        if (barMode) {
            if (modalOpen && tab === k) {return closeModal();}
            setTab(k);
            openModal();
            // the map moves once the panel is up, so the boat (or the race) lands in the part above it
            tick().then(() => setTimeout(() => moveMapFor(k), 60));
        } else {
            setTab(k);
            moveMapFor(k);
        }
    }
    /** Find Milan moves the map to the boat; Whole race leaves the map as the viewer had it (owner, 2 Nov: zooming out
     *  to the whole race undid their zoom; they can zoom out themselves) */
    function moveMapFor(k: Tab) {
        if (k === 'now') {findBoat();}
    }
    let mwrapEl: HTMLElement | null = null;
    /** phones: how much of the map's bottom the panel (or the bar) covers, in px */
    function coveredBelow(): number {
        try {
            if (barMode && modalOpen && mwrapEl) {return Math.max(120, window.innerHeight - mwrapEl.getBoundingClientRect().top + 12);}
        } catch {
            /* the usual space */
        }
        return 120;
    }
    /**
     * Tapping the boat (or its tag): desktop shows Find Milan's page, brings the boat to the middle of the map (the zoom
     * stays) and opens Windy's forecast there on its Wind tab; phones open the forecast (bug 2 Nov: with the forecast
     * already at the boat a tap seemed to do nothing)
     */
    function boatTapped() {
        if (!race) {return;}
        if (!barMode) {
            if (tab !== 'now') {setTab('now');}
            const at = here || race.start;
            try {
                map?.panTo?.([at.lat, at.lon], { animate: true });
            } catch {
                /* the map keeps its place */
            }
        }
        openForecast();
        if (!isMobile) {setTimeout(() => {if (!destroyed) {windTab();}}, 400);}
    }

    /**
     * Windy's forecast on its Wind tab draws a marker where it is: a 200 px white circle with the unit under it, and one
     * arrow per model pointing the way the wind blows (checked on windy.com, 2 Nov: .ww-marker, .ww-marker__circle,
     * .ww-marker__arrow). Owner, 2 Nov: hide the circle while Race Tracker is open, keep the arrows; and Milan's tag
     * goes on the side the arrows don't, so it never covers them.
     */
    const HIDE_RING_CSS = '.ww-marker__circle{display:none!important}';
    function tagSide() {
        try {
            const boat = document.querySelector('.rt-boat');
            if (!boat) {return;}
            const b = boat.getBoundingClientRect();
            let dx = 0;
            let n = 0;
            document.querySelectorAll('.ww-marker').forEach(m => {
                const r = m.getBoundingClientRect();
                if (Math.hypot(r.left - b.left, r.top - b.top) > 30) {return;} // Windy's forecast is somewhere else
                m.querySelectorAll('.ww-marker__arrow > div').forEach(d => {
                    const q = d.getBoundingClientRect();
                    if (!q.width) {return;}
                    dx += (q.left + q.right) / 2 - r.left;
                    n++;
                });
            });
            map.getContainer().classList.toggle('rt-tagleft', n > 0 && dx / n > 8);
        } catch {
            /* the tag stays where it is */
        }
    }

    /** the boat a little smaller as the map zooms out (owner, 2 Nov): a class on the map, read by the marker's CSS */
    function onZoom() {
        try {
            const z = currentZoom();
            const el = map.getContainer();
            el.classList.toggle('rt-zmid', z >= 5 && z < 7);
            el.classList.toggle('rt-zfar', z < 5);
        } catch {
            /* the boat keeps its size */
        }
    }
    /** Find the boat: the map goes there (phones with the panel up: into the part of the map above it) */
    function findBoat() {
        if (!race) {return;}
        const at = here || race.start;
        picked = null;
        raceLayer.pick(null);
        // phones: never closer than zoom 7 (owner, 31 Oct: closer, Windy switches to its outdoor map around the boat)
        const zoom = isMobile ? Math.min(Math.max(currentZoom(), 5), PHONE_ZOOM) : Math.max(currentZoom(), 6);
        try {
            if (barMode && modalOpen) {
                // a box about 250 km across around the boat: by itself it lands around zoom 6–7 on a phone, so it
                // stays out even if the map doesn't honour maxZoom (a tiny box would zoom right in)
                const d = 1.1;
                map.fitBounds([[at.lat - d, at.lon - d], [at.lat + d, at.lon + d]], { paddingTopLeft: [20, 60], paddingBottomRight: [20, coveredBelow()], maxZoom: zoom });
            } else {
                centerMap({ lat: at.lat, lon: at.lon, zoom });
            }
        } catch {
            /* the map keeps its place */
        }
    }
    /** The whole race: the track so far and the finish (before the start: the course) */
    function wholeRace() {
        const v = view();
        if (!v) {return;}
        try {
            raceLayer.fitAll(v);
        } catch (e) {
            console.info('[racetrack] could not fit the race', e);
        }
    }
    /* ---------- Windy's own point forecast, kept on the boat ----------
     * Windy doesn't let a plugin show its point forecast inside the plugin's panel, so racetrack opens the real one
     * (rqstOpen 'detail') at the boat and opens it again at each new position. Desktop: it opens on its own below the
     * map, where Windy always shows it, on the Wind tab (owner's decision, 30 Oct; it used to sit inside the Now page).
     * It stops following when someone opens Windy's forecast somewhere else; the Now page then offers "Back to Milan".
     * Phones: it opens over the map from the Now page or by tapping the boat.
     */
    let pfOpen = false; // Windy's point forecast is open
    let pfOurs = false; // ...and it is at the boat
    let pfAt: { lat: number; lon: number } | null = null;
    let pfSending = false;
    let pfSentAt = 0;

    /**
     * Windy's forecast on its Wind tab (the arrows show where the wind comes from; owner's rule, 30 Oct). Windy ignores a
     * "display" asked for when opening and keeps whichever tab was picked last, so racetrack taps Windy's own Wind tab
     * once the box is there (found by Windy's own word for it, so it works in every language).
     */
    function windTab(): boolean {
        try {
            const n = detailNode();
            if (!n) {return false;}
            const word = (trans as unknown as { t?: Record<string, string> })?.t?.WIND || 'Wind';
            const item = Array.from(n.querySelectorAll<HTMLElement>('.switch__item')).find(e => e.textContent?.trim() === word);
            if (!item) {return false;}
            if (!item.classList.contains('selected')) {item.click();}
            return true;
        } catch {
            return true; // Windy's forecast stays on its own tab
        }
    }
    function windTabSoon() {
        let done = false;
        [150, 500, 1200, 2500].forEach(ms => setTimeout(() => {if (!destroyed && !done) {done = windTab();}}, ms));
    }
    /** wind: racetrack opens it (not just following the boat), so it opens on the Wind tab */
    function sendForecast(at: { lat: number; lon: number }, wind = false) {
        if (!race) {return;}
        pfSending = true;
        pfSentAt = Date.now();
        try {
            const params = { lat: at.lat, lon: at.lon, name: race.athlete.name };
            // Desktop: open Windy's forecast itself, not through rqstOpen. Windy's rule for rqstOpen of a bottom-pane
            // plugin (pluginsCtrl, checked on windy.com 2 Nov) is to close everything in the right-hand pane first, which
            // closed racetrack whenever it was already fully open (the "plugin doesn't open" bug: on opening, following a
            // new position, Back to Milan). The forecast's own open() skips that rule; both stay open (checked on windy.com).
            const det = detailPlugin();
            if (!isMobile && det && typeof det.open === 'function') {
                void Promise.resolve(det.open({ params })).catch(() => bcast.emit('rqstOpen', 'detail', params as never));
            } else {
                bcast.emit('rqstOpen', 'detail', params as never);
            }
            pfOurs = true;
            pfAt = { lat: at.lat, lon: at.lon };
            // Windy says pluginOpened once it's open; until then (or if it never says so) take it as open
            pfOpen = true;
            if (wind) {windTabSoon();}
        } catch (e) {
            console.info('[racetrack] could not open the point forecast', e);
        } finally {
            pfSending = false;
        }
    }
    /** Back to Milan, Show, or tapping the boat: Windy's forecast where the boat is */
    function openForecast() {
        if (!race) {return;}
        if (barMode) {modalOpen = false;}
        sendForecast(here || race.start, true);
    }
    /** Windy's point forecast plugin (plugins.detail) */
    const detailPlugin = (): { open?: (o: { params: unknown }) => unknown } | null => {
        try {
            return (plugins as unknown as Record<string, { open?: (o: { params: unknown }) => unknown }>)?.detail ?? null;
        } catch {
            return null;
        }
    };
    const detailNode = (): HTMLElement | null => {
        try {
            const n = (plugins as unknown as Record<string, { node?: HTMLElement }>)?.detail?.node;
            return n instanceof HTMLElement ? n : null;
        } catch {
            return null;
        }
    };

    // a new position: the forecast moves with the boat (only while it's open at the boat; Windy keeps the viewer's tab)
    $: if (pfOpen && pfOurs && here && pfAt && distanceKm(pfAt, here) > 0.5) {sendForecast(here);}

    const pfEvents: [string, (...a: never[]) => void][] = [
        // the viewer changed units in Windy's settings: racetrack follows
        ['metricChanged', (() => { S = windyUnits(); }) as never],
        ['pluginOpened', ((id: string) => { if (id === 'detail') {pfOpen = true;} }) as never],
        ['pluginClosed', ((id: string) => {
            // Windy may close and reopen it while it moves to the new position: that isn't the viewer closing it
            if (id !== 'detail' || Date.now() - pfSentAt < 2000) {return;}
            // the viewer closed it: the Now page offers it again
            pfOpen = false;
            pfOurs = false;
        }) as never],
        ['rqstOpen', ((id: string, p?: { lat?: number; lon?: number }) => {
            // Windy's forecast opened somewhere else (the viewer picked a place): stop following the boat
            if (id === 'detail' && !pfSending && pfOurs && !(p && pfAt && p.lat === pfAt.lat && p.lon === pfAt.lon)) {pfOurs = false;}
        }) as never],
    ];
    /** desktop: Windy's forecast is open at the boat, on the Wind tab, when racetrack opens and on Find Milan */
    function autoForecast() {
        if (isMobile || !race || (pfOpen && pfOurs)) {return;}
        sendForecast(here || race.start, true);
    }

    /* ---------- Windy's map layer: Wind when racetrack opens; "Things to look out for" switches it ---------- */
    let overlay = '';
    const readOverlay = () => { try { overlay = String(store.get('overlay') ?? ''); } catch { overlay = ''; } };
    const onOverlay = (v: unknown) => { overlay = String(v ?? ''); };
    function showLayer(id: LayerId) {
        try {
            store.set('overlay', id as never);
        } catch (e) {
            console.info('[racetrack] could not switch Windy’s layer', e);
        }
        readOverlay();
    }
    let watch: Watch[] = [];
    $: watch = race ? watchList(race.watch, phase, race.athlete.short) : [];

    /**
     * Phones: Windy's pane around racetrack has its own lighter grey. Paint those boxes in racetrack's background
     * while it is open; their old look comes back on close. Only colours change, nothing moves.
     */
    const painted: { el: HTMLElement; bg: string }[] = [];
    function paintPane() {
        if (!isMobile || !root) {return;}
        try {
            const r = root.getBoundingClientRect();
            let el = root.parentElement;
            for (let i = 0; el && i < 4 && el !== document.body && el !== document.documentElement; i++, el = el.parentElement) {
                const b = el.getBoundingClientRect();
                if (b.height > r.height + 120 || b.top < r.top - 80) {break;}
                painted.push({ el, bg: el.style.background });
                el.style.background = 'var(--rt-uGround, #2e2e2e)';
            }
        } catch {
            /* leave Windy's look */
        }
    }
    function unpaintPane() {
        painted.forEach(({ el, bg }) => (el.style.background = bg));
        painted.length = 0;
    }

    /* ---------- lifecycle ---------- */
    let timer: ReturnType<typeof setInterval> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let sideTimer: ReturnType<typeof setInterval> | undefined;
    function onVisible() {
        if (document.visibilityState === 'visible') {
            now = Date.now();
            if (Date.now() - loadedAt > 60e3) {void refresh();}
        }
    }
    let firstView = true;
    /** the first time the race is there: the map goes to the boat, or shows the course */
    $: if (mapReady && race && st && firstView) {
        firstView = false;
        if (st.phase === 'before') {wholeRace();}
        else {findBoat();}
        autoForecast();
    }

    /**
     * Windy writes its numbers in Bariol (Windy CSS guide, "@bariolNumbers"). Windy loads that font itself, so racetrack
     * looks for it among the page's fonts and uses it for numbers (class "num"); without it, numbers use Windy's base font.
     */
    function findNumbersFont() {
        try {
            const faces = [...(document.fonts as unknown as Iterable<FontFace>)];
            const bariol = faces.find(f => /bariol/i.test(f.family) && !/racetrack/i.test(f.family));
            if (!bariol || document.getElementById('racetrack-num')) {return;}
            const el = document.createElement('style');
            el.id = 'racetrack-num';
            el.textContent = `.racetrack .num, .rt-boat .num { font-family: ${JSON.stringify(bariol.family.replace(/["']/g, ''))}, ${getComputedStyle(root).fontFamily}; }`;
            document.head.appendChild(el);
        } catch {
            /* numbers stay in Windy's base font */
        }
    }

    export const onopen = () => {
        if (Date.now() - loadedAt > 60e3) {void refresh();}
        showLayer('wind');
        autoForecast();
    };

    /** a photo that doesn't load (on the map too): removed, so the initials show instead of the browser's broken picture */
    const onPhotoError = (e: Event) => {
        const el = e.target as HTMLElement | null;
        if (el && el.tagName === 'IMG' && el.parentElement?.classList.contains('rt-ava')) {el.remove();}
    };
    onMount(() => {
        setTimeout(() => {if (!destroyed) {paintPane();}}, 120);
        document.addEventListener('error', onPhotoError, true);
        try {
            map.on('zoomend', onZoom);
        } catch {
            /* the boat keeps its size */
        }
        onZoom();
        const add = (id: string, css: string) => {
            if (document.getElementById(id)) {return;}
            const el = document.createElement('style');
            el.id = id;
            el.textContent = css;
            document.head.appendChild(el);
        };
        add('racetrack-theme', themeCss());
        add('racetrack-hide-ring', HIDE_RING_CSS);
        // the logo's font (everything else uses Windy's own fonts, as Windy's CSS guide says)
        add('racetrack-logo-font', LOGO_FONT_CSS);
        document.addEventListener('visibilitychange', onVisible);
        timer = setInterval(() => { if (document.visibilityState !== 'hidden') {void refresh();} }, REFRESH);
        tickTimer = setInterval(() => (now = Date.now()), 30e3);
        sideTimer = setInterval(tagSide, 1000);
        for (const [topic, f] of pfEvents) {
            try {
                bcast.on(topic as never, f as never);
            } catch {
                /* no events: Show and Hide still work */
            }
        }
        try {
            store.on('overlay' as never, onOverlay as never);
        } catch {
            /* the layer list still switches, it just can't show which one is on */
        }
        showLayer('wind');
        findNumbersFont();
        mapReady = true;
        void refresh();
    });

    onDestroy(() => {
        destroyed = true;
        abort?.abort();
        clearInterval(timer);
        clearInterval(tickTimer);
        clearInterval(sideTimer);
        document.getElementById('racetrack-hide-ring')?.remove();
        document.removeEventListener('visibilitychange', onVisible);
        document.removeEventListener('error', onPhotoError, true);
        try {
            map.off('zoomend', onZoom);
            map.getContainer().classList.remove('rt-zmid', 'rt-zfar', 'rt-tagleft');
        } catch {
            /* already gone */
        }
        window.removeEventListener('error', onWinError);
        window.removeEventListener('unhandledrejection', onRejection);
        errBox?.remove();
        unpaintPane();
        try {
            store.off('overlay' as never, onOverlay as never);
        } catch {
            /* already gone */
        }
        raceLayer.clear();
        for (const [topic, f] of pfEvents) {
            try {
                bcast.off(topic as never, f as never);
            } catch {
                /* already gone */
            }
        }
    });

</script>

<style lang="less">
    @import './ui/application.less';
</style>
