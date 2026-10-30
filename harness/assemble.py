"""Builds harness/sandbox.html: the sandbox page (index.html) with the fake Windy and the compiled plugin inlined,
so it works as one file (open it in a browser, or publish it as a preview)."""
import re, pathlib
h = pathlib.Path(__file__).parent
page = (h / 'index.html').read_text()
mock = (h / 'mock-windy.js').read_text()
plugin = (h.parent / 'dist' / 'plugin.js').read_text()
plugin = re.sub(r'"built": \d+', '"built": 0', plugin, count=1)
plugin = re.sub(r'"builtReadable": "[^"]*"', '"builtReadable": ""', plugin, count=1)
plugin = re.sub(r'\nexport \{[^}]*\};?\s*', '\n', plugin)
plugin = re.sub(r'//# sourceMappingURL=.*', '', plugin).replace('</script', '<\\/script')
page = page.replace('<script src="./mock-windy.js"></script>', '<script>\n' + mock.replace('</script', '<\\/script') + '\n</script>', 1)
load = re.search(r"  const \{ default: Plugin \} = await import\([^\n]*\n", page).group(0)
page = page.replace(load, plugin + '\n', 1)
# the "real" scenario reads files next to the page, which a single file doesn't have
page = page.replace("for (const s of ['racing', 'quiet', 'before', 'finished', 'real'])", "for (const s of ['racing', 'quiet', 'before', 'finished'])")
(h / 'sandbox.html').write_text(page)
print('sandbox.html', len(page) // 1024, 'KB')
