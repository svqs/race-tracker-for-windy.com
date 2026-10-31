"""Screenshots of every screen on desktop and on phones (320–430 px), in every scenario, plus a check for errors.

Needs a server on :8765 at the project root:  python3 -m http.server 8765
Usage: python3 harness/screens.py /tmp/racetrack-screens
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/racetrack-screens')
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://localhost:8765/harness/index.html'
PHONES = [320, 360, 390, 430]
problems = []


def watch(page, name):
    page.on('pageerror', lambda e: problems.append(f'{name}: {e}'))
    page.on('console', lambda m: m.type == 'error' and problems.append(f'{name}: console {m.text}'))


def overflow(page, name):
    """Nothing may stick out sideways in the panel"""
    wide = page.evaluate("""() => {
        const root = document.querySelector('.racetrack'); if (!root) return [];
        const vw = document.documentElement.clientWidth;
        return [...root.querySelectorAll('*')].filter(e => { if (e.closest('.wt-scroll')) return false; const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1; })
            .slice(0, 5).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().right));
    }""")
    if wide:
        problems.append(f'{name}: sticks out {wide}')


with sync_playwright() as p:
    b = p.chromium.launch()
    for scenario in ['racing', 'quiet', 'before', 'finished', 'real']:
        # desktop
        pg = b.new_page(viewport={'width': 1280, 'height': 820})
        watch(pg, f'desktop/{scenario}')
        pg.goto(f'{BASE}?scenario={scenario}&embed')
        pg.wait_for_timeout(1600)
        pg.screenshot(path=str(OUT / f'desktop-{scenario}-now.png'))
        # the three buttons: 0 Find (Now), 1 Whole race (Track), 2 Follow (About)
        for i, tab in [(1, 'track'), (2, 'about')]:
            pg.click(f'.act >> nth={i}')
            pg.wait_for_timeout(300)
            pg.screenshot(path=str(OUT / f'desktop-{scenario}-{tab}.png'))
        if scenario == 'racing':
            pg.click('.act >> nth=1')
            pg.click('.list-card .item >> nth=5')
            pg.wait_for_timeout(300)
            pg.screenshot(path=str(OUT / 'desktop-racing-picked.png'))
            # in the viewer's Windy units (here: km/h and km)
            pg.goto(f'{BASE}?scenario=racing&units=metric')
            pg.wait_for_timeout(1600)
            pg.screenshot(path=str(OUT / 'desktop-racing-metric.png'))
        pg.close()
        # phones
        for w in PHONES if scenario in ('racing', 'before') else [390]:
            ctx = b.new_context(viewport={'width': w, 'height': 760 if w < 390 else 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
            pg = ctx.new_page()
            name = f'phone{w}/{scenario}'
            watch(pg, name)
            pg.goto(f'{BASE}?scenario={scenario}&embed')
            pg.wait_for_timeout(1600)
            pg.screenshot(path=str(OUT / f'phone{w}-{scenario}-bar.png'))
            overflow(pg, name + '/bar')
            for i, tab in [(0, 'now'), (1, 'track'), (2, 'about')]:
                pg.click(f'.mact >> nth={i}')
                pg.wait_for_timeout(450)
                pg.screenshot(path=str(OUT / f'phone{w}-{scenario}-{tab}.png'))
                overflow(pg, f'{name}/{tab}')
            pg.click('.mact >> nth=2')  # the same button again closes the panel
            pg.wait_for_timeout(300)
            pg.click('.mact >> nth=0')  # Find: the Now page, the boat above it
            pg.wait_for_timeout(500)
            pg.click('.mact >> nth=0')  # and closed again: the boat stays in view
            pg.wait_for_timeout(400)
            pg.screenshot(path=str(OUT / f'phone{w}-{scenario}-found.png'))
            if w == 390 and scenario == 'racing':
                pg.click('.rt-boat .rt-ava')
                pg.wait_for_timeout(350)
                pg.screenshot(path=str(OUT / 'phone390-racing-boat-tapped.png'))
                pg.click('#plugin-detail .closing-x')
            ctx.close()
    b.close()

print('\n'.join(problems) if problems else 'no problems')
print('screenshots in', OUT)
sys.exit(1 if problems else 0)
