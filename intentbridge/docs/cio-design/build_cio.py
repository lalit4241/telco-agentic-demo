#!/usr/bin/env python3
"""Generates the IntentBridge CIO architecture SVGs (hand-laid-out, no logos, UK English)."""
from xml.sax.saxutils import escape as esc
import os
OUT = os.path.dirname(os.path.abspath(__file__))
FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
INK, MUTED = "#0F1F33", "#4A5568"
BLUE, BLUE_D, BLUE_L = "#0B5CAB", "#06417A", "#EAF3FC"
TEAL, TEAL_D, TEAL_L = "#0E7C7B", "#075E5D", "#E6F4F3"
GREY, GREY_L, GREY_B = "#5B6573", "#F4F5F7", "#D5D9E0"
AMBER, AMBER_D, AMBER_L = "#E8A317", "#9A5B00", "#FFF6E3"

class S:
    def __init__(s): s.p = []
    def rect(s, x, y, w, h, fill="none", stroke="none", rx=10, sw=1.5, dash=None, extra=""):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        s.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} {extra}/>')
    def text(s, x, y, t, size=18, weight=400, fill=INK, anchor="start", italic=False, ls=None):
        st = ' font-style="italic"' if italic else ""
        l = f' letter-spacing="{ls}"' if ls else ""
        s.p.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}{l}>{esc(t)}</text>')
    def tspans(s, x, y, parts, size=18, anchor="start"):
        inner = "".join(f'<tspan font-weight="{w}" fill="{c}">{esc(t)}</tspan>' for t, w, c in parts)
        s.p.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}">{inner}</text>')
    def line(s, x1, y1, x2, y2, stroke=GREY, sw=2, dash=None, marker=None, start=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = f' marker-end="url(#{marker})"' if marker else ""
        m += f' marker-start="url(#{start})"' if start else ""
        s.p.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}{m}/>')
    def raw(s, t): s.p.append(t)
    def svg(s, w=1920, h=1080, title=""):
        defs = f'''<defs>
<marker id="ag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{GREY}"/></marker>
<marker id="aa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{AMBER_D}"/></marker>
<marker id="at" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{TEAL}"/></marker>
<filter id="sh" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F1F33" flood-opacity="0.10"/></filter>
</defs>'''
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="{FONT}" style="font-feature-settings:\'cv08\' 1">'
                f'<title>{esc(title)}</title>{defs}<rect width="{w}" height="{h}" fill="#FFFFFF"/>' + "\n".join(s.p) + "</svg>")

def chip(s, x, y, w, h, label, fill, stroke, color=INK, size=19, weight=600, dash=None, rx=8):
    s.rect(x, y, w, h, fill, stroke, rx=rx, dash=dash)
    s.text(x + w / 2, y + h / 2 + size * 0.36, label, size, weight, color, "middle")

def header(s, sub):
    s.text(60, 64, "IntentBridge — the headless agent layer for telcos", 42, 800, INK)
    s.text(60, 102, sub, 23, 400, MUTED)
    w = 400; x = 1860 - w
    s.rect(x, 40, w, 46, AMBER_L, AMBER, rx=23)
    s.text(x + w / 2, 70, "Headless by design · no new screens", 20, 700, AMBER_D, "middle")

def layer_label(s, y, h, num, name, sub, color, sub2=None):
    s.rect(60, y, 196, h, color, "none", rx=12)
    s.raw(f'<circle cx="88" cy="{y+30}" r="15" fill="#FFFFFF" fill-opacity="0.25"/>')
    s.text(88, y + 36, str(num), 18, 800, "#FFFFFF", "middle")
    s.text(110, y + 37, name, 21, 800, "#FFFFFF")
    yy = y + 66
    for t in [sub] + ([sub2] if sub2 else []):
        s.text(76, yy, t, 18, 500, "#FFFFFF"); yy += 23

def full():
    s = S()
    header(s, "AIforce agents act across BSS/OSS through governed TM Forum Open APIs")
    X0, X1, XC = 270, 1860, 1580  # content start, end, end of core column (HITL column right)

    # ---- 1 Engage
    y, h = 124, 116
    layer_label(s, y, h, 1, "Engage", "headless:", "#3B4B5F", "no new screen")
    s.rect(X0, y, X1 - X0, h, "#FFFFFF", GREY_B, rx=12)
    s.text(X0 + 18, y + 40, "Channels", 18, 700, MUTED)
    ch = [("Slackforce", 150), ("Claudeforce (beta)", 220), ("Agentforce Coworker", 240),
          ("Salesforce Service & Sales consoles", 380), ("Customer app / IVR", 230)]
    x = X0 + 130
    for t, w in ch:
        chip(s, x, y + 14, w, 40, t, "#FFFFFF", "#9AA5B4", INK, 19, 600); x += w + 12
    s.text(X0 + 18, y + 94, "Personas", 18, 700, MUTED)
    pe = [("Care adviser", 160), ("B2B account manager", 240), ("NOC engineer", 170), ("Field ops", 130),
          ("Product manager", 200), ("Customer", 130)]
    x = X0 + 130
    for t, w in pe:
        chip(s, x, y + 66, w, 38, t, GREY_L, "none", INK, 18, 500, rx=19); x += w + 12

    # ---- 2 AIforce agents
    y, h = 256, 122
    layer_label(s, y, h, 2, "AIforce", "agents", BLUE)
    s.rect(X0, y, XC - X0, h, BLUE_L, BLUE, rx=12)
    s.rect(X0 + 12, y + 12, 236, h - 24, BLUE, "none", rx=10, extra='filter="url(#sh)"')
    s.text(X0 + 130, y + 54, "Superagent", 25, 800, "#FFFFFF", "middle")
    s.text(X0 + 130, y + 84, "front door · A2A", 18, 500, "#FFFFFF", "middle")
    gx, gw, gap = X0 + 262, 252, 10
    row1 = ["Quoting & feasibility", "Care & billing", "Retention", "NOC copilot"]
    for i, t in enumerate(row1):
        chip(s, gx + i * (gw + gap), y + 12, gw, 44, t, "#FFFFFF", BLUE, BLUE_D, 19, 700)
    chip(s, gx, y + 66, gw, 44, "Field ops", "#FFFFFF", BLUE, BLUE_D, 19, 700)
    chip(s, gx + gw + gap, y + 66, gw, 44, "Product & catalogue", "#FFFFFF", BLUE, BLUE_D, 19, 700)
    chip(s, gx + 2 * (gw + gap), y + 66, 2 * gw + gap, 44, "Network-domain agents  ·  via A2A", BLUE_L, BLUE, BLUE_D, 19, 600, dash="6 5")

    # ---- 3 IntentBridge
    y, h = 394, 222
    layer_label(s, y, h, 3, "IntentBridge", "headless agent", TEAL, "layer on MuleSoft")
    s.text(76, y + 112, "Agent Fabric", 18, 500, "#FFFFFF")
    s.rect(X0, y, XC - X0, h, TEAL_L, TEAL, rx=12)
    tiles = [("TMF Open APIs as governed MCP tools", "agents call tools, never systems directly"),
             ("Scoped access per ODA component", "least privilege for every agent"),
             ("TMF921 intent hand-off", "probe → assess → activate with networks")]
    tw = (XC - X0 - 24 - 20) / 3
    for i, (a, b) in enumerate(tiles):
        tx = X0 + 12 + i * (tw + 10)
        s.rect(tx, y + 12, tw, 74, "#FFFFFF", TEAL, rx=10)
        s.text(tx + 16, y + 44, a, 20, 800, TEAL_D)
        s.text(tx + 16, y + 72, b, 18, 400, INK)
    # trust pack strip
    ty = y + 98
    s.rect(X0 + 12, ty, XC - X0 - 24, 112, AMBER_L, AMBER, rx=10, sw=2)
    s.text(X0 + 30, ty + 48, "Trust pack", 22, 800, AMBER_D)
    s.text(X0 + 30, ty + 76, "policy as code", 18, 500, AMBER_D)
    tr = ["£50 credit cap → supervisor", "Vulnerable customer → human", "SIM-swap risk hold",
          "PII masking", "Hash-chained audit", "Agent Evals release gate"]
    cx0, cw = X0 + 190, 362
    for i, t in enumerate(tr):
        r, c = divmod(i, 3)
        chip(s, cx0 + c * (cw + 10), ty + 12 + r * 48, cw, 40, t, "#FFFFFF", AMBER, INK, 19, 600)

    # ---- HITL side column
    hx, hy, hw, hh = XC + 22, 256, X1 - XC - 22, 360
    s.rect(hx, hy, hw, hh, AMBER_L, AMBER, rx=12, sw=2)
    s.text(hx + hw / 2, hy + 36, "Human in the loop", 21, 800, AMBER_D, "middle")
    s.rect(hx + 14, hy + 52, hw - 28, 40, AMBER, "none", rx=8)
    s.text(hx + hw / 2, hy + 79, "Supervisor queue", 19, 800, "#FFFFFF", "middle")
    items = ["Credits over £50", "Vulnerable customers", "SIM-swap holds", "Customer consent", "AM sign-off on quotes"]
    yy = hy + 128
    for t in items:
        s.raw(f'<circle cx="{hx+24}" cy="{yy-6}" r="4" fill="{AMBER_D}"/>')
        s.text(hx + 36, yy, t, 18, 500, INK); yy += 32
    s.text(hx + hw / 2, hy + hh - 22, "approve / reject → audited", 18, 600, AMBER_D, "middle")
    # arrow trust pack -> HITL
    s.line(XC - 12, ty + 56, hx - 4, ty + 56, AMBER_D, 2.5, marker="aa", start="aa")

    # ---- inter-layer connectors
    for cx in (520, 1065, 1420):
        s.line(cx, 242, cx, 254, GREY, 2.5, marker="ag", start="ag")
        s.line(cx, 380, cx, 392, GREY, 2.5, marker="ag", start="ag")
        s.line(cx, 618, cx, 630, GREY, 2.5, marker="ag", start="ag")

    # ---- 4 Systems of record
    y, h = 632, 228
    layer_label(s, y, h, 4, "Systems", "of record,", GREY, "mapped to ODA")
    s.text(76, y + 112, "layers", 18, 500, "#FFFFFF")
    s.text(76, y + 192, "unchanged:", 18, 500, "#FFFFFF")
    s.text(76, y + 215, "no rip & replace", 18, 500, "#FFFFFF")
    s.rect(X0, y, X1 - X0, h, GREY_L, GREY_B, rx=12)
    boxes = [
        ("Party", ["Comms Cloud CRM", "customer & account"], ["TMF629 · TMF666"], 1),
        ("Core Commerce", ["CPQ · catalogue", "order capture"], ["TMF620 · TMF648", "TMF622 · TMF679"], 1),
        ("Billing", ["BSS billing", "& adjustments"], ["TMF678 · TMF677"], 1),
        ("Production", None, None, 1.85),
        ("Network domains", ["Autonomous networks", "intent handler"], ["TMF921"], 1),
        ("Intelligence", ["Data 360", "unified data & signals"], [], 1),
    ]
    inner = X1 - X0 - 24 - 5 * 10
    unit = inner / sum(b[3] for b in boxes)
    bx = X0 + 12
    for name, lines, codes, wgt in boxes:
        bw = unit * wgt
        s.rect(bx, y + 12, bw, h - 24, "#FFFFFF", GREY_B, rx=10)
        s.rect(bx, y + 12, bw, 6, GREY, "none", rx=3)
        s.text(bx + 16, y + 50, name, 21, 800, INK)
        if lines is None:
            s.text(bx + 16, y + 80, "OSS inventory & orchestration", 18, 500, INK)
            s.text(bx + bw - 16, y + 106, "TMF638 · TMF639 · TMF641", 18, 700, TEAL_D, "end")
            prod = [("Assurance", "TMF656 · TMF642"), ("ITSM", "TMF621"), ("Field Service", "TMF646")]
            yy = y + 140
            for a, c in prod:
                s.text(bx + 16, yy, a, 18, 500, INK)
                s.text(bx + bw - 16, yy, c, 18, 700, TEAL_D, "end"); yy += 28
        else:
            yy = y + 84
            for t in lines:
                s.text(bx + 16, yy, t, 18, 500, INK); yy += 26
            yy += 12
            for c in codes:
                s.text(bx + 16, yy, c, 18, 700, TEAL_D); yy += 26
        if name == "Network domains":
            s.text(bx + 16, y + h - 26, "← A2A agents", 18, 500, BLUE_D)
        bx += bw + 10

    # ---- 5 Outcomes
    y, h = 876, 132
    layer_label(s, y, h, 5, "Outcomes", "for the CIO", INK)
    outs = [("Lower cost to serve", ["Bills, credits and faults resolved", "in the tools people already use"]),
            ("Revenue protection", ["Retention offers within authority;", "credits governed by policy"]),
            ("Faster B2B quote-to-cash", ["Feasibility proven by TMF921", "probe before the quote"]),
            ("Resilience & compliance", ["Ofcom · GDPR · EU AI Act · TSA", "human oversight, full audit trail"])]
    ow = (X1 - X0 - 3 * 14) / 4
    for i, (t, ls) in enumerate(outs):
        ox = X0 + i * (ow + 14)
        s.rect(ox, y, ow, h, "#FFFFFF", INK, rx=12, sw=2)
        s.rect(ox, y, 8, h, TEAL, "none", rx=4)
        s.text(ox + 26, y + 42, t, 23, 800, INK)
        s.text(ox + 26, y + 76, ls[0], 18, 400, MUTED)
        s.text(ox + 26, y + 102, ls[1], 18, 400, MUTED)

    # ---- footer
    s.text(60, 1056, "TMF = TM Forum Open API · ODA = Open Digital Architecture · A2A = agent-to-agent", 18, 400, MUTED)
    bw = 790; bx = 1860 - bw
    s.rect(bx, 1028, bw, 40, TEAL_L, TEAL, rx=20)
    s.text(bx + bw / 2, 1055, "✓ Proven in a working model: 16/16 Apex tests · 100% coverage · live demo", 18, 700, TEAL_D, "middle")
    return s.svg(title="IntentBridge — the headless agent layer for telcos")

def glance():
    s = S()
    header(s, "AIforce agents act across BSS/OSS through governed TM Forum Open APIs")
    X0, X1 = 60, 1860
    bands = [
        ("People & channels", "Engage, headless", "Slackforce, Coworker, Salesforce consoles, customer app & IVR",
         "No new screen: agents work where people already work", "#FFFFFF", "#3B4B5F"),
        ("AIforce agents", "Think & act", "A Superagent front door plus specialist agents",
         "Quoting, care & billing, retention, NOC, field ops, catalogue · A2A to network agents", BLUE_L, BLUE),
        ("IntentBridge", "Govern & connect", "TM Forum Open APIs as governed tools on MuleSoft Agent Fabric",
         "Trust pack: credit cap, vulnerable-customer & SIM-swap holds, PII masking, audit", TEAL_L, TEAL),
    ]
    y = 136
    for i, (name, verb, l1, l2, fill, stroke) in enumerate(bands):
        h = 160
        s.rect(X0, y, X1 - X0, h, fill, stroke, rx=16, sw=2.5)
        s.rect(X0, y, 420, h, stroke, "none", rx=16)
        s.rect(X0 + 400, y, 20, h, stroke, "none", rx=0)
        s.text(X0 + 36, y + 72, name, 38, 800, "#FFFFFF")
        s.text(X0 + 36, y + 114, verb, 24, 500, "#FFFFFF")
        s.text(X0 + 460, y + 70, l1, 31, 700, INK)
        s.text(X0 + 460, y + 114, l2, 24, 400, MUTED)
        if i < 2:
            for cx in (700, 1260):
                s.line(cx, y + h + 4, cx, y + h + 22, GREY, 3, marker="ag", start="ag")
        y += h + 26
    # systems strip
    s.rect(X0, y, X1 - X0, 66, GREY_L, GREY_B, rx=12)
    s.tspans(X0 + 36, y + 43, [("Existing BSS / OSS, CRM and network domains  ", 800, INK),
                               ("mapped to ODA layers, unchanged: no rip & replace", 400, MUTED)], 24)
    y += 94
    outs = ["Lower cost to serve", "Revenue protection", "Faster B2B quote-to-cash", "Resilience & compliance"]
    ow = (X1 - X0 - 3 * 20) / 4
    for i, t in enumerate(outs):
        ox = X0 + i * (ow + 20)
        s.rect(ox, y, ow, 128, "#FFFFFF", INK, rx=14, sw=2.5)
        s.rect(ox, y, 10, 128, TEAL, "none", rx=5)
        s.text(ox + ow / 2 + 5, y + 75, t, 30, 800, INK, "middle")
    s.text(960, 976, "Designed for Ofcom, GDPR, EU AI Act and TSA duties: policy as code, human oversight, hash-chained audit", 22, 500, MUTED, "middle")
    bw = 790; bx = 1860 - bw
    s.rect(bx, 1026, bw, 42, TEAL_L, TEAL, rx=21)
    s.text(bx + bw / 2, 1054, "✓ Proven in a working model: 16/16 Apex tests · 100% coverage · live demo", 18, 700, TEAL_D, "middle")
    return s.svg(title="IntentBridge at a glance")

open(os.path.join(OUT, "intentbridge-cio-architecture.svg"), "w").write(full())
open(os.path.join(OUT, "intentbridge-cio-one-glance.svg"), "w").write(glance())
print("ok")
