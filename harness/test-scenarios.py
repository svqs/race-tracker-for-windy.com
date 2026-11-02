"""Browser scenarios: the real plugin in the sandbox (fake Windy), one check list per scenario.

    npm run build && python3 -m http.server 8765 &      (from the repository folder)
    python3 harness/test-scenarios.py                    (or: npm run test:scenarios)

Every scenario is written up in docs/testing.md (section S). Exits with 1 if any check fails, and prints a table.
Screenshots of each scenario go to /tmp/racetrack-scenarios (or the folder given as the first argument).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/harness/index.html'
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/racetrack-scenarios')
OUT.mkdir(parents=True, exist_ok=True)
results = []

WHERE_FC = """(() => { const n = document.getElementById('plugin-detail');
  return !n || !n.isConnected ? 'closed' : n.closest('.racetrack') ? 'in the panel' : 'under map'; })()"""
FC_TAB = "(document.querySelector('#plugin-detail .switch__item.selected') || {}).textContent || ''"
LAYER = "W.store.get('overlay')"
# names cut off (… or clipped) in the button row
CUT = "sel => [...document.querySelectorAll(sel)].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)"


def check(name, ok, detail=''):
    results.append(('✓' if ok else '✗', name, '' if ok else str(detail)))


def text(pg, sel):
    loc = pg.locator(sel)
    return loc.first.inner_text() if loc.count() else ''


def open_page(b, query, w=1280, h=900, phone=False, keep_storage=None):
    ctx = keep_storage or (b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True) if phone
                           else b.new_context(viewport={'width': w, 'height': h}))
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.goto(f'{BASE}?{query}')
    pg.wait_for_timeout(2600)
    return ctx, pg


def shot(pg, name, phone=False):
    clip = None if phone else {'x': 880, 'y': 0, 'width': 400, 'height': pg.viewport_size['height']}
    pg.screenshot(path=str(OUT / f'{name}.png'), clip=clip)


def no_errors(pg, name):
    check(f'{name}: no script errors', not pg.errors, '; '.join(pg.errors[:2]))


with sync_playwright() as p:
    b = p.chromium.launch()

    # S1 racing ---------------------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing')
    check('S1 racing: three buttons', pg.locator('.act').all_inner_texts() == ['Find Milan', 'Whole race', 'Follow Milan'], pg.locator('.act').all_inner_texts())
    check('S1 racing: Find Milan is selected', text(pg, '.act.on') == 'Find Milan')
    check('S1 racing: says when the last position came', 'Last position 12 min ago' in text(pg, '.status-line'), text(pg, '.status-line'))
    check('S1 racing: the boat is on the map, live (blue)', pg.locator('.rt-boat:not(.quiet)').count() == 1)
    check('S1 racing: conditions with three numbers', pg.locator('.c-three > div').count() == 3)
    check("S1 racing: Windy's forecast is open below the map, not in the panel", pg.evaluate(WHERE_FC) == 'under map', pg.evaluate(WHERE_FC))
    check("S1 racing: …on Windy's Wind tab", pg.evaluate(FC_TAB) == 'Wind', pg.evaluate(FC_TAB))
    check('S1 racing: the map shows Windy\'s wind layer', pg.evaluate(LAYER) == 'wind', pg.evaluate(LAYER))
    w = pg.locator('.watch .witem b').all_inner_texts()
    check('S1 racing: things to look out for: Wind, Waves, Pressure, Ocean currents', w == ['Wind', 'Waves', 'Pressure', 'Ocean currents'], w)
    check('S1 racing: …Wind is the one on the map', text(pg, '.witem.on b') == 'Wind', text(pg, '.witem.on'))
    check('S1 racing: no extra notes under the last position', pg.locator('.status-line ~ small.line').count() == 0)
    shot(pg, 'S1-racing')
    no_errors(pg, 'S1')
    ctx.close()

    # S2 quiet ----------------------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=quiet')
    check('S2 quiet: "Last position 5 h ago"', 'Last position 5 h ago' in text(pg, '.status-line'), text(pg, '.status-line'))
    check('S2 quiet: no note about the tracker (only the time)', 'tracker can go quiet' not in pg.inner_text('.racetrack'))
    check('S2 quiet: the boat turns grey, no pulse', pg.locator('.rt-boat.quiet').count() == 1 and
          pg.evaluate("getComputedStyle(document.querySelector('.rt-boat .rt-pulse')).display") == 'none')
    shot(pg, 'S2-quiet')
    no_errors(pg, 'S2')
    ctx.close()

    # S3 before ---------------------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=before')
    check('S3 before: countdown', 'Starts in' in pg.inner_text('.racetrack'))
    check('S3 before: "The race hasn’t started yet"', text(pg, '.status-line.wait') == 'The race hasn’t started yet', text(pg, '.status-line'))
    check('S3 before: "Conditions at the start"', 'Conditions at the start' in text(pg, '.cond'))
    check('S3 before: the boat where it is now (the harbour), live, no speed', pg.locator('.rt-boat:not(.quiet)').count() == 1 and 'kt' not in text(pg, '.rt-tagline'), text(pg, '.rt-tagline'))
    check('S3 before: no track drawn yet, the boat card isn\'t shown', pg.evaluate("document.querySelectorAll('.mock-line').length") <= 1 and pg.locator('.boatcard').count() == 0)
    check('S3 before: the middle button says "The course"', pg.locator('.act').nth(1).inner_text() == 'The course')
    shot(pg, 'S3-before')
    no_errors(pg, 'S3')
    ctx.close()

    # S4 finished, S5 retired -------------------------------------------------------------------------------------
    for sid, sc, word in [('S4', 'finished', 'Finished in'), ('S5', 'retired', 'Out of the race')]:
        ctx, pg = open_page(b, f'scenario={sc}')
        check(f'{sid} {sc}: "{word}"', word in pg.inner_text('.racetrack'))
        check(f'{sid} {sc}: race time instead of live speed', 'Race time' in text(pg, '.stats'), text(pg, '.stats'))
        check(f'{sid} {sc}: the boat is grey', pg.locator('.rt-boat.quiet').count() == 1)
        shot(pg, f'{sid}-{sc}')
        no_errors(pg, sid)
        ctx.close()

    # S6 empty: started, no position yet --------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=empty')
    check('S6 empty: the panel shows (racing, no boat yet)', pg.locator('.card.head').count() == 1 and pg.locator('.rt-boat').count() == 0)
    check('S6 empty: "The race has started. Milan’s first position shows up here soon."', 'first position shows up here soon' in text(pg, '.status-line.wait') and 'Last position' not in pg.inner_text('.racetrack'), text(pg, '.status-line'))
    pg.click('.act >> nth=1')
    pg.wait_for_timeout(300)
    check('S6 empty: the track page says there are no positions yet', 'No positions yet' in pg.inner_text('.racetrack'))
    shot(pg, 'S6-empty')
    no_errors(pg, 'S6')
    ctx.close()

    # S7 messy track ----------------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=messy')
    speed = text(pg, '.stats > div:first-child .big')
    try:
        v = float(speed.split()[0])
    except ValueError:
        v = -1
    check('S7 messy: a sane speed (the 400-knot glitch is dropped)', 0 < v < 20, speed)
    check('S7 messy: "Last position 12 min ago" (the future position is dropped)', 'Last position 12 min ago' in text(pg, '.status-line'), text(pg, '.status-line'))
    pg.click('.act >> nth=1')
    pg.wait_for_timeout(300)
    times = pg.locator('.list-card .item .t').all_inner_texts()[:6]
    check('S7 messy: the track list is newest first, no repeats', len(times) == len(set(times)) and len(times) > 3, times)
    no_errors(pg, 'S7')
    ctx.close()

    # S8 live: a new position arrives ------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=live')
    before = pg.locator('.rt-boat .rt-hull').bounding_box()
    sent = []
    pg.evaluate("() => { window.__sent = []; const d = W.plugins.detail, o = d.open; d.open = (x) => { window.__sent.push([x.params.lat, x.params.lon]); return o(x); }; }")
    pg.evaluate('window.__racetrackRefresh()')
    pg.wait_for_timeout(2500)
    after = pg.locator('.rt-boat .rt-hull').bounding_box()
    sent = pg.evaluate('window.__sent')
    check('S8 live: "Last position just now" after the refresh', 'just now' in text(pg, '.status-line'), text(pg, '.status-line'))
    check('S8 live: the boat moved on the map', before and after and (abs(before['x'] - after['x']) + abs(before['y'] - after['y'])) > 1, (before, after))
    check("S8 live: Windy's forecast follows to the new position", len(sent) >= 1, sent)
    check("S8 live: …and stays below the map", pg.evaluate(WHERE_FC) == 'under map', pg.evaluate(WHERE_FC))
    no_errors(pg, 'S8')
    ctx.close()

    # S9 slow -----------------------------------------------------------------------------------------------------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.goto(f'{BASE}?scenario=slow')
    pg.wait_for_timeout(900)
    check('S9 slow: "Loading the race…" while it waits', 'Loading the race' in pg.inner_text('.racetrack'))
    pg.wait_for_timeout(9000)
    check('S9 slow: then the race shows (both files, 4 s each)', pg.locator('.stats').count() == 1)
    no_errors(pg, 'S9')
    ctx.close()

    # S10 broken track.json, S11 offline then back online ----------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=broken')
    check('S10 broken file, nothing earlier: "Couldn\'t load the race" and Try again', "Couldn’t load the race" in pg.inner_text('.racetrack') and pg.locator('button:has-text("Try again")').count() == 1)
    shot(pg, 'S10-broken')
    no_errors(pg, 'S10')
    ctx.close()
    ctx, pg = open_page(b, 'scenario=offline')
    check('S11 offline: the error card with Try again', pg.locator('button:has-text("Try again")').count() == 1)
    pg.evaluate('window.__mockOnline = true')
    pg.click('button:has-text("Try again")')
    pg.wait_for_timeout(1500)
    check('S11 offline: back online, Try again loads the race', pg.locator('.stats').count() == 1)
    no_errors(pg, 'S11')
    ctx.close()

    # S12 cached: an earlier visit, now nothing loads --------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing')
    pg.goto(f'{BASE}?scenario=cached')
    pg.wait_for_timeout(2600)
    check('S12 cached: the race from the earlier visit shows straight away', pg.locator('.stats').count() == 1 and 'Milan' in text(pg, '.who'))
    check('S12 cached: no error message on top of it', "Couldn" not in pg.inner_text('.racetrack'))
    no_errors(pg, 'S12')
    ctx.close()

    # S13 photo doesn't load --------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=nophoto')
    pg.wait_for_timeout(500)
    nat = pg.evaluate("[...document.querySelectorAll('.rt-ava img')].map(i => i.naturalWidth)")
    check('S13 no photo: the initials are there and the broken photo draws nothing (removed, also in the tag on the map)', pg.locator('.who .rt-ava .rt-ini').inner_text() == 'MK' and pg.locator('.rt-boat .rt-ini').inner_text() == 'MK' and pg.locator('.rt-boat .rt-ava img').count() == 0 and all(n == 0 for n in nat), nat)
    shot(pg, 'S13-nophoto')
    no_errors(pg, 'S13')
    ctx.close()

    # S14 the viewer's Windy units ---------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing&units=metric')
    st = text(pg, '.stats')
    check('S14 units: km/h and km from Windy\'s settings', 'km/h' in st and ' km' in st, st)
    ctx.close()

    # S15 Windy's forecast and layers ------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing')
    check('S15 forecast: open at the boat, no forecast card in the panel', pg.locator('.card.pf').count() == 0, pg.locator('.card.pf').count())
    pg.click('#plugin-detail .switch__item >> text=Airgram'); pg.wait_for_timeout(200)
    view = "(() => { const c = W.map.map.getCenter(); return [c.lat.toFixed(3), c.lng.toFixed(3), W.map.map.getZoom()]; })()"
    v0 = pg.evaluate(view)
    pg.click('.act >> nth=1'); pg.wait_for_timeout(400)
    check('S15 Whole race leaves the map where the viewer had it (no zooming out)', pg.evaluate(view) == v0, (v0, pg.evaluate(view)))
    check('S15 forecast: Whole race → it stays open below the map', pg.evaluate(WHERE_FC) == 'under map', pg.evaluate(WHERE_FC))
    
    pg.evaluate("W.broadcast.emit('rqstOpen', 'detail', { lat: 40, lon: -30 })"); pg.wait_for_timeout(500)
    pg.click('.act >> nth=0'); pg.wait_for_timeout(1500)
    check('S15 forecast: opened somewhere else, then Find Milan → back at the boat, on the Wind tab', pg.locator('.card.pf').count() == 0 and pg.evaluate(FC_TAB) == 'Wind', pg.evaluate(FC_TAB))
    pg.click('#plugin-detail .switch__item >> text=Basic'); pg.wait_for_timeout(200)
    pg.evaluate("W.broadcast.emit('rqstOpen', 'detail', { lat: 40, lon: -30 })"); pg.wait_for_timeout(500)
    check('S15 forecast: opened somewhere else → "Back to Milan"', 'Back to Milan' in text(pg, '.pf-btn'), text(pg, '.pf-btn'))
    pg.click('.pf-btn'); pg.wait_for_timeout(1500)
    check('S15 forecast: Back to Milan → at the boat again, on the Wind tab', pg.locator('.card.pf').count() == 0 and pg.evaluate(FC_TAB) == 'Wind', pg.evaluate(FC_TAB))
    pg.click('.witem >> nth=2'); pg.wait_for_timeout(200)
    check('S15 layers: Pressure → Windy\'s map shows pressure, and it says so', pg.evaluate(LAYER) == 'pressure' and text(pg, '.witem.on b') == 'Pressure', (pg.evaluate(LAYER), text(pg, '.witem.on')))
    pg.click('.act >> nth=1'); pg.wait_for_timeout(300); pg.click('.act >> nth=0'); pg.wait_for_timeout(300)
    check('S15 layers: switching pages keeps the viewer\'s layer', pg.evaluate(LAYER) == 'pressure', pg.evaluate(LAYER))
    pg.evaluate("W.store.set('overlay', 'waves')"); pg.wait_for_timeout(200)
    check('S15 layers: a layer picked in Windy shows here too', text(pg, '.witem.on b') == 'Waves', text(pg, '.witem.on'))
    pg.evaluate("racetrack.onopen()"); pg.wait_for_timeout(300)
    check('S15 layers: opening Race Tracker again → wind', pg.evaluate(LAYER) == 'wind', pg.evaluate(LAYER))
    shot(pg, 'S15-layers')
    no_errors(pg, 'S15')
    ctx.close()

    # S15b before the start: tides; race.json's own line
    ctx, pg = open_page(b, 'scenario=before')
    w = pg.locator('.watch .witem b').all_inner_texts()
    check('S15 before the start: Wind, Waves, Pressure, Tidal currents', w == ['Wind', 'Waves', 'Pressure', 'Tidal currents'], w)
    ctx.close()
    ctx, pg = open_page(b, 'scenario=real')
    t = pg.inner_text('.watch')
    check("S15 real race.json: its own tides line (Saint-Malo) before the start", 'Saint-Malo has some of the biggest tides' in t or 'Ocean currents' in t, t[:200])
    ctx.close()

    # S20 Windy's forecast never closes Race Tracker (bug 2 Nov: rqstOpen of the forecast closes the right-hand pane) ------
    ctx, pg = open_page(b, 'scenario=live')
    pg.evaluate("window.__paneClosed = 0")
    pg.click('.act >> nth=0'); pg.wait_for_timeout(800)
    pg.evaluate('window.__racetrackRefresh()'); pg.wait_for_timeout(2500)
    pg.evaluate("W.broadcast.emit('rqstOpen', 'detail', { lat: 40, lon: -30 })"); pg.wait_for_timeout(500)
    pg.click('.pf-btn'); pg.wait_for_timeout(800)
    check('S20 the forecast: opened, followed to a new position and Back to Milan, all without Windy\'s rqstOpen (which would close Race Tracker)', pg.evaluate("window.__paneClosed") == 1 and pg.evaluate(WHERE_FC) == 'under map', pg.evaluate("window.__paneClosed"))
    no_errors(pg, 'S20')
    ctx.close()

    # S16 the top card stays put; nothing draws over it -----------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing', h=620)
    bad = []
    for y in [0, 150, 300, 500]:
        pg.evaluate(f"document.querySelector('.racetrack').scrollTop = {y}"); pg.wait_for_timeout(150)
        r = pg.evaluate("""(() => { const h = document.querySelector('.card.head').getBoundingClientRect();
          const pts = [[h.left + 40, h.top + 20], [h.left + 200, h.bottom - 20], [h.right - 30, h.bottom - 8]];
          return [Math.round(h.top), pts.filter(([x, y]) => !(document.elementFromPoint(x, y) || {closest: () => null}).closest('.card.head')).length]; })()""")
        if (y and r[0] != 0) or r[1]:
            bad.append((y, r))
    check('S16 scrolling: the top card stays at the top and nothing draws over it', not bad, bad)
    shot(pg, 'S16-scrolled')
    ctx.close()

    # S17 the Follow page ------------------------------------------------------------------------------------------
    ctx, pg = open_page(b, 'scenario=racing')
    pg.click('.act >> nth=2'); pg.wait_for_timeout(300)
    links = pg.evaluate("[...document.querySelectorAll('.about .lnk')].map(a => [a.textContent.trim(), a.href, a.target, a.rel])")
    check('S17 follow: Milan ×2, Windy.com ×2, the race website', len(links) == 5, links)
    check('S17 follow: every link https, in a new tab, noopener', all(l[1].startswith('https://') and l[2] == '_blank' and 'noopener' in l[3] for l in links), links)
    check('S17 follow: no second header (no photo, name or about text repeated)', pg.locator('.about .rt-ava').count() == 0)
    ctx.close()

    # S19 the video card (Find Milan's page, under the conditions; only when there is a video) ------------------------
    ctx, pg = open_page(b, 'scenario=racing')
    check('S19 video: no video yet → no card', pg.locator('.vid').count() == 0)
    ctx.close()
    ctx, pg = open_page(b, 'scenario=racing&video=wide')
    check('S19 video: before play, its thumbnail and a play button, no YouTube player yet (so no YouTube title bar)', pg.locator('.vid iframe').count() == 0 and 'aqz-KE-bpKQ' in (pg.get_attribute('.poster img', 'src') or ''))
    pg.click('.poster'); pg.wait_for_timeout(300)
    src = pg.get_attribute('.vid iframe', 'src') or ''
    box = pg.locator('.player').bounding_box()
    order = pg.evaluate("[...document.querySelectorAll('.cond, .vid, .watch')].map(e => e.classList.contains('vid') ? 'video' : e.classList.contains('watch') ? 'watch' : 'conditions')")
    check('S19 video: right under the conditions', order[:3] == ['conditions', 'video', 'watch'], order)
    check('S19 video: play → YouTube\'s privacy-enhanced player, playing, wide (16:9), no related videos from others', src.startswith('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ') and 'rel=0' in src and 'autoplay=1' in src and box and abs(box['width'] / box['height'] - 16 / 9) < 0.02, (src, box))
    check('S19 video: its title and when it was posted', 'Sample: a wide video' in text(pg, '.vmeta'), text(pg, '.vmeta'))
    tw = pg.evaluate("getComputedStyle(document.querySelector('.vmeta .vt')).fontWeight")
    check('S19 video: the title under it in regular weight (not bold)', tw == '400', tw)
    shot(pg, 'S19-video-wide')
    ctx.close()
    ctx, pg = open_page(b, 'scenario=racing&video=both')
    box = pg.locator('.player').bounding_box()
    check('S19 video: a YouTube Short shows upright (9:16), the newest first', 'jNQXAC9IVRw' in (pg.get_attribute('.poster img', 'src') or '') and box and abs(box['height'] / box['width'] - 16 / 9) < 0.02, box)
    check('S19 video: the earlier one listed under it', pg.locator('.vitem').count() == 1)
    shot(pg, 'S19-video-short')
    pg.click('.vitem'); pg.wait_for_timeout(300)
    check('S19 video: tapping the earlier one plays it instead', 'aqz-KE-bpKQ' in (pg.get_attribute('.vid iframe', 'src') or '') and 'jNQXAC9IVRw' in (pg.get_attribute('.vitem img', 'src') or ''))
    pg.click('.act >> nth=1'); pg.wait_for_timeout(300)
    check('S19 video: another page stops the video (the player is gone)', pg.locator('.vid iframe').count() == 0)
    pg.click('.act >> nth=0'); pg.wait_for_timeout(300)
    check('S19 video: back on Find Milan it doesn\'t start by itself (thumbnail again)', pg.locator('.vid iframe').count() == 0 and pg.locator('.poster').count() == 1)
    no_errors(pg, 'S19')
    ctx.close()
    ctx, pg = open_page(b, 'scenario=racing&video=auto')
    check('S19 video: found by the Action (data/videos.json) → it shows too', 'aqz-KE-bpKQ' in (pg.get_attribute('.poster img', 'src') or ''))
    ctx.close()
    for q, want in [('wide', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=PLsample12345'), ('short', 'https://www.youtube.com/shorts/jNQXAC9IVRw')]:
        ctx, pg = open_page(b, f'scenario=racing&video={q}', w=390, h=844, phone=True)
        pg.click('.mact >> nth=0'); pg.wait_for_timeout(700)
        a_ = pg.evaluate("(() => { const a = document.querySelector('.mwrap.open .vlink'); return a && [a.href, a.target, a.rel, a.innerText]; })()")
        check(f'S19 video phone ({q}): a link "Watch video updates from the boat" to the newest video on YouTube (in the playlist), no player', bool(a_) and a_[0] == want and a_[1] == '_blank' and 'noopener' in a_[2] and 'Watch video updates from the boat' in a_[3] and pg.locator('.mwrap .player').count() == 0, a_)
        if q == 'wide': shot(pg, 'S19-video-phone', phone=True)
        ctx.close()

    # S21 the rank, the earlier videos in a sideways row, the link to the race tracker (owner, 2 Nov) ----------------
    ctx, pg = open_page(b, 'scenario=racing&video=many')
    check('S21 rank: a pill next to the name, "8th of 49" (ranking.json)', text(pg, '.card.head .who .rank') == '8th of 49', text(pg, '.card.head .who .rank'))
    rk = pg.evaluate("(() => { const a = document.querySelector('.card.head .who a.rank'); return a && [a.href, a.target, a.rel]; })()")
    check('S21 rank: tapping it opens the race tracker in a new window', bool(rk) and rk[0] == 'https://carto.routedurhum.com/en/index.html' and rk[1] == '_blank' and 'noopener' in rk[2], rk)
    side = pg.evaluate("(() => { const t = document.querySelector('.rt-tagline').getBoundingClientRect(), h = document.querySelector('.rt-hull').getBoundingClientRect(); return t.right < h.left; })()")
    check('S21 boat: on desktop the tag sits on the boat\'s left (Windy\'s forecast labels fan out to the right)', side)
    check('S21 rank: in the tag on the map too, "8th"', text(pg, '.rt-tagline .rt-rank') == '8th', text(pg, '.rt-tagline .rt-rank'))
    lst = pg.evaluate("(() => { const l = document.querySelector('.vlist'); const im = l.querySelector('.vitem img').getBoundingClientRect(); return [l.querySelectorAll('.vitem').length, l.scrollHeight > l.clientHeight, Math.round(l.getBoundingClientRect().height), Math.round(im.width), Math.round(im.height)]; })()")
    check('S21 videos: all five earlier ones in a short list that scrolls inside the card, small thumbnails (64 x 36)', lst[0] == 5 and lst[1] and lst[2] <= 140 and lst[3] == 64 and lst[4] == 36, lst)
    a_ = pg.evaluate("(() => { const a = document.querySelector('a.fleet'); return a && [a.href, a.target, a.rel, a.innerText.trim(), !!a.nextElementSibling]; })()")
    check('S21 link: "See the whole fleet on the Route du Rhum tracker", opens the race tracker in a new window, last on the page, no arrow', bool(a_) and a_[0] == 'https://carto.routedurhum.com/en/index.html' and a_[1] == '_blank' and 'noopener' in a_[2] and a_[3] == 'See the whole fleet on the Route du Rhum tracker' and not a_[4], a_)
    tag = pg.evaluate("[...document.querySelector('.rt-tagline').children].map(e => e.classList.contains('rt-ava') ? 'photo' : e.tagName === 'B' ? 'name' : e.tagName === 'EM' ? 'speed' : e.classList.contains('rt-rank') ? 'rank' : e.classList.contains('rt-flag') || e.tagName === 'svg' || e.tagName === 'SVG' ? 'flag' : e.className)")
    check('S21 boat: the tag reads photo, name, speed, rank, flag', tag == ['photo', 'name', 'speed', 'rank', 'flag'], tag)
    hull = pg.evaluate("(() => { W.map.map.getContainer().classList.remove('rt-zmid', 'rt-zfar'); const h = document.querySelector('.rt-boat .rt-hull'); const r = h.getBoundingClientRect(); return [h.style.transform, h.offsetWidth, h.offsetHeight, !!document.querySelector('.rt-boat .rt-beam')]; })()")
    check('S21 boat: a black Class40 (20 x 40 zoomed in) turned to its course, no beam', hull[0].startswith('rotate(') and hull[1] == 20 and hull[2] == 40 and not hull[3], hull)
    shot(pg, 'S21-rank-videos-link')
    # tapping the boat: Find Milan's page, the boat to the middle (same zoom), the forecast there (bug 2 Nov: nothing seemed to happen)
    pg.click('.act >> nth=1'); pg.wait_for_timeout(300)
    z0 = pg.evaluate("W.map.map.getZoom()")
    pg.evaluate("window.__panTo = null"); opened = pg.evaluate("(() => { window.__opens = 0; const o = W.plugins.detail.open; W.plugins.detail.open = (a) => { window.__opens++; return o(a); }; return true; })()")
    pg.locator('.rt-boat .rt-tagline').click(); pg.wait_for_timeout(600)
    tapped = pg.evaluate("[document.querySelector('.act.on, .act[aria-pressed=\"true\"]')?.textContent.trim() || '', window.__panTo, W.map.map.getZoom(), window.__opens]")
    check('S21 boat: tapping its tag shows Find Milan, brings the boat to the middle without zooming, and opens the forecast', 'Find' in tapped[0] and tapped[1] is not None and tapped[2] == z0 and tapped[3] >= 1, tapped)
    # zoomed out the boat gets smaller
    sizes = pg.evaluate("""(() => { const el = W.map.map.getContainer(); el.classList.remove('rt-zmid', 'rt-zfar'); const h = () => document.querySelector('.rt-boat .rt-hull').offsetWidth; const out = [h()];
        el.classList.add('rt-zmid'); out.push(h()); el.classList.remove('rt-zmid'); el.classList.add('rt-zfar'); out.push(h()); el.classList.remove('rt-zfar'); return out; })()""")
    check('S21 boat: smaller as the map zooms out (20, 16, 13 px wide)', sizes == [20, 16, 13], sizes)
    no_errors(pg, 'S21')
    ctx.close()
    for q in ['rank=none', 'scenario=finished', 'scenario=before']:
        ctx, pg = open_page(b, q if q.startswith('scenario') else 'scenario=racing&' + q)
        check(f'S21 rank: none shown ({q})', pg.locator('.rank').count() == 0 and pg.locator('.rt-rank').count() == 0)
        ctx.close()
    for w in [320, 390]:
        ctx, pg = open_page(b, 'scenario=racing', w=w, h=760 if w < 390 else 844, phone=True)
        pg.click('.mact >> nth=0'); pg.wait_for_timeout(700)
        nm = pg.evaluate("(() => { const n = document.querySelector('.mwrap .who .nm'); return n && [n.scrollWidth, n.clientWidth]; })()")
        check(f'S21 phone {w}: his whole name shows next to the rank (the pill drops to its own line when narrow)', bool(nm) and nm[0] <= nm[1] and text(pg, '.mwrap .who .rank') == '8th of 49', nm)
        hw = pg.evaluate("(() => { const el = W.map.map.getContainer(); el.classList.remove('rt-zmid', 'rt-zfar'); const h = () => document.querySelector('.rt-boat .rt-hull').offsetWidth; const out = [h()]; el.classList.add('rt-zmid'); out.push(h()); el.classList.remove('rt-zmid'); el.classList.add('rt-zfar'); out.push(h()); return out; })()")
        z = pg.evaluate("[W.map.map.getZoom(), W.map.map.getContainer().className]")
        check(f'S21 phone {w}: the boat a step smaller than on desktop at every zoom (16, 13, 11 px wide)', hw == [16, 13, 11], (hw, z))
        ctx.close()

    # S18 phones ---------------------------------------------------------------------------------------------------
    for w in [320, 390]:
        ctx, pg = open_page(b, 'scenario=racing', w=w, h=760 if w < 390 else 844, phone=True)
        check(f'S18 phone {w}: the bar has the three buttons, every name whole', pg.locator('.mact').count() == 3 and pg.evaluate(CUT, '.mact span') == [], pg.evaluate(CUT, '.mact span'))
        pg.evaluate("() => { window.__fits = []; const m = W.map.map, f = m.fitBounds; m.fitBounds = (b, o) => { window.__fits.push([b, o]); return f(b, o); }; }")
        pg.click('.mact >> nth=0'); pg.wait_for_timeout(900)
        fit = pg.evaluate("(() => { const [b, o] = window.__fits.at(-1) || [[[0, 0], [0, 0]], {}]; return [Math.abs(b[1][1] - b[0][1]), o.maxZoom]; })()")
        check(f'S18 phone {w}: Find Milan stays out (a box over 2° across, at most zoom 7), not into Windy\'s outdoor map', fit[0] >= 2 and fit[1] <= 7, fit)
        box = pg.locator('.rt-boat .rt-hull').bounding_box()
        top = pg.evaluate("document.querySelector('.mwrap').getBoundingClientRect().top")
        check(f'S18 phone {w}: Find Milan opens the Now page with the boat above it', pg.locator('.mwrap.open').count() == 1 and box and box['y'] + box['height'] < top, (box, top))
        over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll('.mwrap *')].some(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('#plugin-detail, .wpf') })")
        check(f'S18 phone {w}: nothing sticks out sideways', not over)
        shot(pg, f'S18-phone{w}', phone=True)
        pg.click('.mact >> nth=0'); pg.wait_for_timeout(400)
        check(f'S18 phone {w}: the same button closes the panel', pg.locator('.mwrap.open').count() == 0)
        no_errors(pg, f'S18 {w}')
        ctx.close()
    b.close()

w = max(len(r[1]) for r in results)
for r in results:
    print(f'{r[0]}  {r[1].ljust(w)}  {r[2]}')
bad = [r for r in results if r[0] == '✗']
print(f"\n{len(results) - len(bad)} of {len(results)} browser checks pass" + (f', {len(bad)} fail' if bad else ''))
print(f'screenshots in {OUT}')
sys.exit(1 if bad else 0)
