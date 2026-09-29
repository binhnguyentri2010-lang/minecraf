#!/usr/bin/env python3
"""Inline the production build into one HTML file for the Artifact viewer: python3 scripts-build-artifact.py out.html"""
import glob, sys
js = open(glob.glob('dist/assets/*.js')[0], encoding='utf8').read().replace('</script', '<\\/script').replace('<!--', '<\\!--')
css = open(glob.glob('dist/assets/*.css')[0], encoding='utf8').read()
out = sys.argv[1] if len(sys.argv) > 1 else 'bang-toan.html'
open(out, 'w', encoding='utf8').write(
    f'<title>Bảng Toán</title>\n<style>{css}</style>\n<div id="boot" aria-hidden="true"><i></i><b>Bảng Toán</b><i></i></div>\n<div id="root"></div>\n<script type="module">{js}</script>\n')
print(out, len(js) // 1024, 'KB js')
