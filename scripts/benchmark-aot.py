#!/usr/bin/env python3
"""Local Linux benchmark: python3 scripts/benchmark-aot.py /path/to/canary/bun [samples]."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
BUN = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 5
if not BUN or not BUN.is_file() or SAMPLES < 1 or sys.platform != 'linux':
    raise SystemExit('Usage: python3 scripts/benchmark-aot.py /path/to/canary/bun [positive samples] (Linux)')
ENV = dict(os.environ, PATH=f'{BUN.parent}{os.pathsep}{os.environ.get("PATH", "")}')
if BUN.name != 'bun':
    raise SystemExit('The supplied runtime must be named bun so subprocesses can find it on PATH')

def run(args, cwd):
    start = time.monotonic()
    with tempfile.TemporaryFile() as out:
        child = subprocess.Popen([str(a) for a in args], cwd=cwd, env=ENV, stdout=out, stderr=subprocess.STDOUT)
        _, status, usage = os.wait4(child.pid, 0)
        out.seek(0)
        return {'exit': os.waitstatus_to_exitcode(status), 'seconds': time.monotonic() - start,
                'peak_kib': usage.ru_maxrss, 'log': out.read().decode(errors='replace')}

def require(result, label):
    if result['exit'] != 0:
        raise RuntimeError(f'{label} exited {result["exit"]}:\n{result["log"][-6000:]}')

def hashes(dist):
    result = {}
    for f in sorted(dist.rglob('*')):
        if not f.is_file():
            continue
        data = f.read_bytes()
        if f.name == 'sitemap.xml':
            # Dynamic lastmod timestamps change between runs; preserve paths and all other bytes.
            data = re.sub(rb'(<lastmod>)\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z(</lastmod>)', rb'\1TIME\2', data)
        result[str(f.relative_to(dist))] = hashlib.sha256(data).hexdigest()
    return result

with tempfile.TemporaryDirectory(prefix='bunki-aot-bench-') as tmp:
    tmp = Path(tmp)
    revision = run([BUN, '--revision'], ROOT)
    require(revision, 'Bun revision')
    print('Bun:', revision['log'].strip(), 'platform:', sys.platform, os.uname().machine, 'samples:', SAMPLES, flush=True)
    bins = {}
    for name, flags in [('jit', ['--no-aot']), ('aot', ['--aot', '--aot-allow-code-from-disk'])]:
        bins[name] = tmp / name
        result = run([BUN, 'build', 'src/cli.ts', '--compile', *flags, '--outfile', bins[name]], ROOT)
        require(result, name + ' compilation')
        print('build', name, 'seconds', round(result['seconds'], 4), 'peak_kib', result['peak_kib'], 'bytes', bins[name].stat().st_size, flush=True)
    site = tmp / 'site'
    shutil.copytree(ROOT / 'fixtures', site)
    (site / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    config = '''export default { title: "AOT-CHECK-487", description: "Fixture", baseUrl: "https://fixture.example", domain: "fixture.example", site: { title: "AOT-CHECK-487", description: "Fixture", url: "https://fixture.example", author: "Fixture" }, css: { enabled: true, input: "templates/styles/main.css", output: "css/style.css", processor: "postcss", postcssConfig: "postcss.config.cjs" } };\n'''
    plugin = '''module.exports = { plugins: [{ postcssPlugin: "fixture", Once(root) { root.append({ selector: ".aot-plugin-sentinel", nodes: [{ prop: "color", value: "rebeccapurple" }] }); } }] };\n'''
    (site / 'config.ts').write_text(config)
    (site / 'postcss.config.cjs').write_text(plugin)
    commands = {'source': [BUN, ROOT / 'src/cli.ts'], 'jit': [bins['jit']], 'aot': [bins['aot']]}
    samples = {name: [] for name in commands}
    startups = {name: [] for name in commands}
    expected = None
    names = list(commands)
    for iteration in range(SAMPLES):
        for name in names[iteration % 3:] + names[:iteration % 3]:
            shutil.rmtree(site / 'dist', ignore_errors=True)
            result = run(commands[name] + ['generate', '-c', 'config.ts'], site)
            require(result, name + ' generation')
            current = hashes(site / 'dist')
            if expected is None:
                expected = current
            if current != expected or 'AOT-CHECK-487' not in (site / 'dist/index.html').read_text() or 'aot-plugin-sentinel' not in (site / 'dist/css/style.css').read_text():
                raise RuntimeError(f'{name} output differs or config/plugin was not applied')
            result.pop('log')
            samples[name].append(result)
            startup = run(commands[name] + ['--version'], site)
            require(startup, name + ' startup')
            startup.pop('log')
            startups[name].append(startup)
    for name in names:
        for label, results in [('generate', samples[name]), ('startup', startups[name])]:
            print(name, label, 'median_seconds', round(statistics.median(r['seconds'] for r in results), 4), 'median_peak_kib', statistics.median(r['peak_kib'] for r in results), flush=True)
    print('Equivalent files:', len(expected), '(sitemap lastmod normalized); config and plugin markers present')
    for name, command in commands.items():
        (site / 'postcss.config.cjs').write_text('throw new Error("synthetic plugin failure");\n')
        failed = run(command + ['generate', '-c', 'config.ts'], site)
        if failed['exit'] == 0 or 'PostCSS processing failed' not in failed['log']:
            raise RuntimeError(f'{name} silently accepted a broken PostCSS plugin: {failed["log"][-2000:]}')
        (site / 'postcss.config.cjs').write_text(plugin)
        (site / 'config.ts').write_text('not valid javascript !!!!\n')
        failed = run(command + ['generate', '-c', 'config.ts'], site)
        if failed['exit'] == 0 or 'Error loading config file' not in failed['log']:
            raise RuntimeError(f'{name} silently accepted invalid configuration: {failed["log"][-2000:]}')
        (site / 'config.ts').write_text(config)
    print('Broken plugin and invalid config rejected by all variants')
