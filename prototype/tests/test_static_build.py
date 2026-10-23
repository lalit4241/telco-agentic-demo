"""The offline single-file build embeds the JS engine + data and has no external dependencies."""
import re

import build_static


def test_static_build_is_self_contained():
    html = build_static.main().read_text()
    assert "Demo – mock data only" in html and "TelcoEngine.create(" in html
    # no external scripts, stylesheets or CDN fetches
    assert not re.search(r'<script[^>]+src=', html)
    assert not re.search(r'<link[^>]+stylesheet', html)
    assert "cdn." not in html and "pyodide" not in html.lower()
