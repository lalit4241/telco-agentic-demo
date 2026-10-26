#!/usr/bin/env python3
"""Generate the TelForce brand SVGs: the T network mark and lockups (original artwork, no third-party marks)."""
import os
OUT = os.path.dirname(os.path.abspath(__file__))
BLUE, NAVY, SKY, INK = "#0176D3", "#032D60", "#90D0FE", "#032D60"
FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

def tf_mark(x=0, y=0, s=512, gid="tfg"):
    k = s / 512
    return f'''<g transform="translate({x} {y}) scale({k})">
  <defs><linearGradient id="{gid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{NAVY}"/><stop offset="1" stop-color="{BLUE}"/></linearGradient></defs>
  <rect width="512" height="512" rx="116" fill="url(#{gid})"/>
  <path d="M138 168 H374 M256 168 V352" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round"/>
  <circle cx="138" cy="168" r="34" fill="{SKY}"/><circle cx="374" cy="168" r="34" fill="{SKY}"/>
  <circle cx="256" cy="372" r="38" fill="#fff"/>
  <path d="M190 398 A78 78 0 0 0 322 398" fill="none" stroke="{SKY}" stroke-width="18" stroke-linecap="round" opacity=".9"/>
</g>'''

def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">{b}{body}</svg>\n'

def tf_lockup(dark):
    t, acc, sub = ("#fff", SKY, "#c7dcf2") if dark else (INK, BLUE, "#3d4a63")
    return svg(640, 128, tf_mark(0, 0, 128, "tfg" + ("d" if dark else "l")) +
        f'<text x="156" y="76" font-family="{FONT}" font-size="60" font-weight="780" letter-spacing="-1.2" fill="{t}">Tel<tspan fill="{acc}">Force</tspan></text>'
        f'<text x="158" y="110" font-family="{FONT}" font-size="22" font-weight="500" letter-spacing="0.4" fill="{sub}">The Agentic Telco</text>')

files = {
    "telforce-mark.svg": svg(512, 512, tf_mark()),
    "telforce-lockup-light.svg": tf_lockup(False),
    "telforce-lockup-dark.svg": tf_lockup(True),
    "favicon.svg": svg(512, 512, tf_mark()),
}
for n, c in files.items():
    open(os.path.join(OUT, n), "w").write(c)
print("wrote", ", ".join(files))
