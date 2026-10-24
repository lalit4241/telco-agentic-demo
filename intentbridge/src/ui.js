/* IntentBridge UI (vanilla JS, no dependencies). */
(function () {
  'use strict';
  var IB = window.IntentBridge;
  var S = { eng: null, tab: 'demo', scen: 'b2b', params: { customer: 'CUST-1001' }, runner: null, surface: 'slack', supervisor: 'Hannah Lee (Care supervisor)', calc: IB.calcDefaults(), preset: 'base', apiTool: 'customer.get', apiAgent: 'billing', apiRaw: false, apiResult: null, selTool: 'billAdjustment.create', lastKpi: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var J = function (o) { return esc(JSON.stringify(o, null, 2)); };
  var LANE = { 'u:AM': 'Account manager', 'u:Customer': 'Customer', 'u:NOC': 'NOC engineer', 'u:Engineer': 'Field engineer', 'u:PM': 'Product manager', fabric: 'Agent Fabric', superagent: 'Superagent',
    quoting: 'Quoting agent', anHandler: 'AN intent handler', orchestrator: 'Order orchestration', slo: 'SLO insights', billing: 'Billing agent', retention: 'Retention agent', noc: 'NOC copilot', field: 'Field assistant', product: 'Product agent',
    crm: 'Comms Cloud', bss: 'Billing BSS', oss: 'OSS', assure: 'OSS assurance', itsm: 'ServiceNow', an: 'AN domain', d360: 'Data 360', fsl: 'Field Service' };
  var SURF = { slack: 'Slackforce (simulated)', coworker: 'Agentforce Coworker (simulated)', claude: 'Claudeforce (simulated, beta)', customer: 'Customer app chat' };

  function newEngine() {
    S.eng = new IB.Engine(); S.runner = null;
    var pending = false;
    S.eng.on(function () { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; render(); }); });
    window.__ib = S;
  }

  /* ---------- KPI strip ---------- */
  function kpiHtml() {
    return S.eng.kpis().map(function (k) {
      var fl = S.lastKpi[k.key] !== undefined && S.lastKpi[k.key] !== k.value; S.lastKpi[k.key] = k.value;
      return '<div class="kpi' + (fl ? ' flash' : '') + '" data-kpi="' + k.key + '"><b>' + esc(k.value) + '</b><small>' + esc(k.label) + '</small></div>';
    }).join('');
  }

  /* ---------- Demo tab ---------- */
  function scenList() {
    return Object.keys(IB.JOURNEYS).map(function (id) {
      var j = IB.JOURNEYS[id];
      return '<button class="scen' + (S.scen === id ? ' on' : '') + '" data-scen="' + id + '"><b>' + (j.flagship ? '<span class="tag">Flagship</span>' : '') + esc(j.title) + '</b><small>' + esc(j.persona) + '</small></button>';
    }).join('');
  }
  function stepList() {
    var j = IB.JOURNEYS[S.scen], r = S.runner && S.runner.journey.id === S.scen ? S.runner : null;
    return '<ol class="steps">' + j.steps.map(function (s, i) {
      var st = r ? r.stepStates[i] : 'pending'; if (r && i === r.i && st === 'pending' && r.status !== 'done') st = 'next';
      return '<li class="' + st + '" data-step="' + i + '"><span class="dot">' + (st === 'done' ? '\u2713' : i + 1) + '</span><span>' + esc(s.title) + '<small>' + esc(s.tmf) + (s.human ? ' \u00b7 human step' : '') + '</small></span></li>';
    }).join('') + '</ol>';
  }
  function controls() {
    var j = IB.JOURNEYS[S.scen], r = S.runner && S.runner.journey.id === S.scen ? S.runner : null;
    var params = (j.params || []).map(function (p) {
      return '<label class="small muted">' + esc(p.label) + '<br><select id="param-' + p.key + '" style="width:100%">' + p.options.map(function (o) { return '<option value="' + o.value + '"' + (S.params[p.key] === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></label>';
    }).join('');
    var st = r ? r.status : 'ready';
    var stTxt = { ready: 'Ready', running: 'Running', waiting: '\u23f8 Waiting for a human: open the Supervisor queue', done: '\u2713 Journey complete', halted: '\u25a0 Stopped by a human decision' }[st];
    return params + '<div class="row" style="margin-top:8px"><button class="btn" id="btn-step"' + (st === 'done' || st === 'halted' || st === 'waiting' ? ' disabled' : '') + '>\u25b6 Next step</button><button class="btn sec" id="btn-run"' + (st === 'done' || st === 'halted' || st === 'waiting' ? ' disabled' : '') + '>Run to end</button><button class="btn sec" id="btn-restart">Restart</button></div>' +
      '<p class="small" id="run-status" data-status="' + st + '" style="margin:8px 0 0"><b>' + esc(stTxt) + '</b></p>';
  }
  function surfaceHtml() {
    var tabs = Object.keys(SURF).map(function (k) { var n = S.eng.surfaces[k].length; return '<button data-surf="' + k + '" class="' + (S.surface === k ? 'on' : '') + '">' + esc(SURF[k]) + (n ? ' (' + n + ')' : '') + '</button>'; }).join('');
    var msgs = S.eng.surfaces[S.surface], body = '';
    if (!msgs.length) body = '<p class="muted small" style="padding:12px">No messages yet. Pick a scenario and press <b>Next step</b>.</p>';
    else if (S.surface === 'slack') {
      var chans = {}; msgs.forEach(function (m) { (chans[m.channel || '#general'] = chans[m.channel || '#general'] || []).push(m); });
      Object.keys(chans).forEach(function (c) { body += '<div class="chan">' + esc(c) + '</div>' + chans[c].map(msgHtml).join(''); });
    } else body = msgs.map(msgHtml).join('');
    var hint = { slack: 'Generic team-chat view standing in for Slackforce. Not Slack\u2019s UI.', coworker: 'Side-panel assistant for staff (Agentforce Coworker), simulated.', claude: 'AM working in Claude with Salesforce data (Claudeforce, beta), simulated.', customer: 'Customer-facing chat with AI disclosure (EU AI Act Art. 50).' }[S.surface];
    return '<div class="stabs">' + tabs + '</div><div class="small muted" style="margin-bottom:6px">' + esc(hint) + '</div><div class="surface ' + S.surface + '" id="surface">' + body + '</div>';
  }
  function msgHtml(m) {
    var ini = (m.author || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    var card = m.card ? '<div class="mcard"><b>' + esc(m.card.title) + '</b>' + m.card.rows.map(function (r) { return '<div>' + esc(r) + '</div>'; }).join('') + '</div>' : '';
    return '<div class="msg"><div class="av ' + (m.role || 'agent') + '">' + esc(ini || 'AI') + '</div><div><div class="who">' + esc(m.author) + (m.role === 'agent' ? ' <span class="pill p-info">AI agent</span>' : '') + (m.disclosure ? '<span class="disc">AI disclosure</span>' : '') + '<small>' + esc((m.ts || '').slice(11, 19)) + '</small></div><div class="txt">' + esc(m.text) + '</div>' + card + '</div></div>';
  }
  function seqSvg(r) {
    var lanes = r.journey.lanes.slice();
    r.trace.forEach(function (e) { [e.from, e.to].forEach(function (l) { if (l && lanes.indexOf(l) < 0) lanes.push(l); }); });
    var W = 92, top = 44, rowH = 26, w = lanes.length * W + 20, h = top + r.trace.length * rowH + 20;
    var X = function (l) { return 10 + lanes.indexOf(l) * W + W / 2; };
    var o = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" font-family="system-ui,sans-serif" font-size="10"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="#3d4a63"/></marker><marker id="ahp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="#6b3fa0"/></marker></defs>';
    lanes.forEach(function (l) {
      var x = X(l), fab = l === 'fabric';
      o += '<line x1="' + x + '" y1="' + (top - 8) + '" x2="' + x + '" y2="' + (h - 6) + '" stroke="' + (fab ? '#0b5cad' : '#cfd5df') + '" stroke-dasharray="' + (fab ? '0' : '3,3') + '" stroke-width="' + (fab ? 2 : 1) + '"/>';
      o += '<rect x="' + (x - W / 2 + 4) + '" y="4" width="' + (W - 8) + '" height="26" rx="5" fill="' + (fab ? '#0b5cad' : l.indexOf('u:') === 0 ? '#2f855a' : IB.AGENTS[l] ? '#14213d' : '#6b778c') + '"/><text x="' + x + '" y="21" fill="#fff" text-anchor="middle" font-weight="600">' + esc(LANE[l] || l) + '</text>';
    });
    r.trace.forEach(function (e, i) {
      var y = top + i * rowH + 12, x1 = X(e.from), x2 = X(e.to);
      var col = e.kind === 'a2a' ? '#6b3fa0' : e.decision === 'deny' || e.tone === 'bad' ? '#b42318' : e.decision === 'escalate' || e.tone === 'warn' ? '#a15c00' : '#3d4a63';
      if (e.kind === 'policy') { o += '<rect x="' + (x1 - 40) + '" y="' + (y - 9) + '" width="80" height="16" rx="3" fill="#fff" stroke="' + col + '"/><text x="' + x1 + '" y="' + (y + 2) + '" text-anchor="middle" fill="' + col + '">policy</text>'; o += '<text x="' + (x1 + 44) + '" y="' + (y + 3) + '" fill="' + col + '">' + esc(e.label.slice(0, 70)) + '</text>'; return; }
      o += '<line x1="' + x1 + '" y1="' + y + '" x2="' + (x2 + (x2 > x1 ? -3 : 3)) + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.4" ' + (e.kind === 'a2a' ? 'stroke-dasharray="5,3" marker-end="url(#ahp)"' : 'marker-end="url(#ah)"') + '/>';
      if (e.kind === 'call' && lanes.indexOf('fabric') >= 0) { var fx = X('fabric'); var dc = e.decision === 'allow' ? '#1a7f4b' : e.decision === 'deny' ? '#b42318' : '#a15c00'; o += '<rect x="' + (fx - 5) + '" y="' + (y - 5) + '" width="10" height="10" transform="rotate(45 ' + fx + ' ' + y + ')" fill="' + dc + '"/>'; }
      o += '<text x="' + (Math.min(x1, x2) + 6) + '" y="' + (y - 4) + '" fill="' + col + '">' + esc((e.seq) + '. ' + e.label.slice(0, 64)) + '</text>';
    });
    return o + '</svg>';
  }
  function traceHtml() {
    var r = S.runner && S.runner.journey.id === S.scen ? S.runner : null;
    if (!r || !r.trace.length) return '<p class="muted small">The sequence diagram and every TMF call, A2A message and policy decision appear here as the journey runs. Diamonds on the Agent Fabric line show the gateway decision: <span class="ok">allow</span>, <span style="color:#a15c00">escalate</span>, <span class="bad">deny</span>.</p>';
    var evs = r.trace.slice().reverse().map(function (e) {
      var pill = e.kind === 'call' ? '<span class="pill p-' + e.decision + '">' + esc(e.decision) + '</span>' : e.kind === 'a2a' ? '<span class="pill p-a2a">A2A</span>' : '<span class="pill p-info">' + esc(e.kind) + '</span>';
      var head = '<summary>' + pill + '<b>' + e.seq + '.</b> ' + esc(LANE[e.from] || e.from) + ' \u2192 ' + esc(LANE[e.to] || e.to) + ': ' + esc(e.label) + (e.rule ? ' <span class="muted">[' + esc(e.rule) + ']</span>' : '') + '</summary>';
      return e.payload ? '<details class="ev">' + head + (e.path ? '<div class="mono" style="padding:4px 8px">' + esc(e.method + ' ' + e.path) + ' \u00b7 ODA: ' + esc(e.oda) + (e.reason ? ' \u00b7 ' + esc(e.reason) : '') + '</div>' : '') + '<pre class="json">' + J(e.payload) + '</pre></details>' : '<div class="ev"><summary>' + head.slice(9, -10) + '</summary></div>';
    }).join('');
    return '<div class="seqwrap" id="seq">' + seqSvg(r) + '</div><div class="events" id="events">' + evs + '</div>';
  }
  function demoTab() {
    var j = IB.JOURNEYS[S.scen];
    return '<div class="grid3"><div class="card"><h2>Scenarios</h2>' + scenList() +
      '<h3>Ask the superagent</h3><div class="row"><input id="ask" style="flex:1" placeholder="e.g. Why is my bill higher?"><button class="btn sec" id="btn-ask">Route</button></div><div id="ask-out" class="small" style="margin-top:6px">' + (S.askOut || '') + '</div></div>' +
      '<div class="card"><h2>' + esc(j.title) + '</h2><p class="small muted" style="margin-top:0">' + esc(j.summary) + '</p>' + controls() + stepList() + '<h3>AIforce surfaces</h3>' + surfaceHtml() + '</div>' +
      '<div class="card"><h2>Trace: sequence and payloads</h2>' + traceHtml() + '</div></div>';
  }

  /* ---------- Agent Fabric tab ---------- */
  function fabricTab() {
    var tools = S.eng.tools(), odas = []; tools.forEach(function (t) { if (odas.indexOf(t.oda) < 0) odas.push(t.oda); });
    var trows = tools.map(function (t) { return '<tr data-tool="' + t.name + '" style="cursor:pointer' + (S.selTool === t.name ? ';background:#e8f1fb' : '') + '"><td class="mono">' + esc(t.name) + '</td><td>' + t.tmf + '</td><td>' + esc(t.oda) + '</td><td>' + esc(t.system) + '</td><td>' + (t.write ? '<b>write</b>' : 'read') + (t.facade ? ' \u00b7 facade' : '') + '</td></tr>'; }).join('');
    var sel = tools.filter(function (t) { return t.name === S.selTool; })[0];
    var mcp = { jsonrpc: '2.0', result: { tools: [{ name: sel.name, title: sel.tmf + ' ' + sel.title, description: sel.description + ' [ODA component: ' + sel.oda + ']', inputSchema: sel.inputSchema, annotations: { readOnlyHint: !sel.write, destructiveHint: false } }] } };
    var agents = Object.keys(IB.AGENTS);
    var matrix = '<table class="t"><tr><th>ODA component</th>' + agents.map(function (a) { return '<th style="font-size:11px">' + esc(LANE[a] || a) + '</th>'; }).join('') + '</tr>' + odas.map(function (o) { return '<tr><td>' + esc(o) + '</td>' + agents.map(function (a) { var s = IB.AGENTS[a].scopes[o]; return '<td class="' + (s ? 'scope-' + s : '') + '">' + (s || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
    var v = S.eng.verifyAudit();
    var audit = S.eng.audit.slice().reverse().slice(0, 200).map(function (e) { return '<tr><td>' + e.seq + '</td><td class="mono">' + e.ts.slice(11, 19) + '</td><td>' + esc(e.actor) + '</td><td class="mono">' + esc(e.tool || '') + '</td><td>' + esc(e.tmf || '') + '</td><td><span class="pill p-' + (e.decision === 'rejected' ? 'deny' : e.decision) + '">' + esc(e.decision) + '</span></td><td class="small">' + esc(e.rule || '') + '</td><td class="mono" title="' + e.hash + '">' + e.hash.slice(0, 10) + '\u2026</td><td class="mono">' + e.prevHash.slice(0, 10) + '\u2026</td></tr>'; }).join('');
    var P = S.eng.policy;
    return '<div class="g2"><div class="card"><h2>MCP tool catalogue (TMF Open APIs as governed tools)</h2><p class="small muted">Click a tool to see its MCP <span class="mono">tools/list</span> descriptor. Every call passes injection screening, ODA scope check, policy check, PII masking and audit.</p><div style="max-height:360px;overflow:auto"><table class="t"><tr><th>Tool</th><th>TMF</th><th>ODA component</th><th>System of record</th><th>Mode</th></tr>' + trows + '</table></div><h3>Descriptor</h3><pre class="json" style="border-radius:7px">' + J(mcp) + '</pre></div>' +
      '<div class="card"><h2>Trust pack (policies as code)</h2><div class="row small"><label>Auto-credit cap £ <input id="pol-cap" type="number" value="' + P.autoCreditCap + '" style="width:70px"></label><label>SIM-swap risk threshold <input id="pol-sim" type="number" value="' + P.simSwapThreshold + '" style="width:60px"></label><label>Agent discount authority % <input id="pol-disc" type="number" value="' + P.discountAuthorityPct + '" style="width:60px"></label></div>' +
      '<ul class="small"><li>Prompt-injection screening on utterances and every tool argument</li><li>Per-agent scopes by ODA component (R / W), enforced at the gateway</li><li>Credit over the cap \u2192 supervisor approval; vulnerable customer \u2192 human; SIM-swap risk \u2192 step-up</li><li>Orders need AM confirmation or recorded consent; commercial agents raise probe intents only; launches need governance</li><li>Personal data tokenised before it reaches any agent or log</li></ul>' +
      '<h3>Scopes: agents \u00d7 ODA components</h3><div style="overflow:auto">' + matrix + '</div></div></div>' +
      '<div class="card" style="margin-top:12px"><h2>Immutable audit log (SHA-256 hash chain)</h2><div class="row"><button class="btn sec" id="btn-verify">Verify chain</button><button class="btn bad" id="btn-tamper">Simulate tampering with entry #1</button><span id="verify-out" class="small ' + (v.ok ? 'ok' : 'bad') + '"><b>' + (v.ok ? '\u2713 Chain intact: ' + v.entries + ' entries, head ' + (v.head || '').slice(0, 12) + '\u2026' : '\u2717 Chain broken at entry #' + v.brokenAt) + '</b></span></div><div style="max-height:380px;overflow:auto;margin-top:8px"><table class="t"><tr><th>#</th><th>Time</th><th>Actor</th><th>Tool</th><th>TMF</th><th>Decision</th><th>Rule</th><th>Hash</th><th>Prev</th></tr>' + (audit || '<tr><td colspan="9" class="muted">No entries yet</td></tr>') + '</table></div></div>';
  }

  /* ---------- Queue tab ---------- */
  function queueTab() {
    var items = S.eng.queue.slice().reverse();
    var body = items.length ? items.map(function (q) {
      return '<div class="qitem ' + q.status + '" data-q="' + q.id + '"><div class="row"><b>' + q.id + '</b><span class="pill p-escalate">' + esc(q.kindLabel) + '</span><span class="pill p-' + (q.status === 'approved' ? 'allow' : q.status === 'rejected' ? 'deny' : 'info') + '">' + q.status + '</span><span class="small muted">raised by ' + esc(LANE[q.agent] || q.agent) + ' \u00b7 ' + esc(q.tool) + '</span></div>' +
        '<div style="margin:6px 0"><b>' + esc(q.title) + '</b></div><div class="small">' + esc(q.reason) + (q.amount ? ' \u00b7 Amount ' + IB.gbp(q.amount) : '') + '</div>' +
        '<details class="small"><summary>Proposed action (masked)</summary><pre class="json" style="border-radius:7px">' + J(IB.maskPII(q.args)) + '</pre></details>' +
        (q.status === 'pending' ? '<div class="row" style="margin-top:6px"><button class="btn ok" data-approve="' + q.id + '">Approve</button><button class="btn bad" data-reject="' + q.id + '">Reject</button></div>' : '<div class="small muted">' + q.status + ' by ' + esc(q.resolvedBy) + (q.result && q.result.response && q.result.response.body && q.result.response.body.id ? ' \u2192 created ' + esc(q.result.response.body.id) : '') + '</div>') + '</div>';
    }).join('') : '<p class="muted">Nothing waiting. Run a journey: the B2B order, credits above the cap, vulnerable customers, SIM-swap holds and product launches land here.</p>';
    return '<div class="card"><h2>Supervisor queue (human in the loop)</h2><div class="row small" style="margin-bottom:8px"><label>Acting as <input id="sup-name" value="' + esc(S.supervisor) + '" style="width:240px"></label><span class="muted">Approving executes the held action through the gateway as you, and it is audited.</span></div>' + body + '</div>';
  }

  /* ---------- Evals tab ---------- */
  function evalsTab() {
    var ev = S.eng.lastEvals;
    var rows = ev ? ev.map(function (r) { return '<tr><td>' + (r.pass ? '<span class="pill p-allow">PASS</span>' : '<span class="pill p-deny">FAIL</span>') + '</td><td class="mono">' + r.id + '</td><td>' + esc(r.name) + (r.error ? ' <span class="bad">' + esc(r.error) + '</span>' : '') + '</td></tr>'; }).join('') : '';
    return '<div class="card"><h2>Agent Evals (offline gate before release)</h2><p class="small muted">Each case runs on a fresh copy of the model: injection, vulnerable-customer, credit-cap, SIM-swap, scope, PII, intent-feasibility, consent and audit-integrity checks. In a real estate these run on every model or prompt change (MuleSoft Agent Evals / Agentforce Testing Center).</p><button class="btn" id="btn-evals">Run eval suite</button> ' + (ev ? '<b id="eval-score" style="margin-left:8px">' + ev.filter(function (r) { return r.pass; }).length + ' / ' + ev.length + ' passed</b>' : '') + (ev ? '<table class="t" style="margin-top:10px"><tr><th>Result</th><th>Id</th><th>Case</th></tr>' + rows + '</table>' : '') + '</div>';
  }

  /* ---------- CIO tab ---------- */
  function cioTab() {
    var c = IB.calc(S.calc), max = Math.max.apply(null, c.levers.map(function (l) { return l.value; })) || 1;
    var m = function (v) { return '\u00a3' + (v / 1e6).toFixed(1) + 'm'; };
    var inputs = IB.CALC_FIELDS.map(function (f) { return '<label>' + esc(f[1]) + '<input type="number" step="any" data-calc="' + f[0] + '" value="' + esc(S.calc[f[0]]) + '"></label>'; }).join('');
    var segs = ['conservative', 'base', 'stretch'].map(function (p) { return '<button data-preset="' + p + '" class="' + (S.preset === p ? 'on' : '') + '">' + p[0].toUpperCase() + p.slice(1) + '</button>'; }).join('');
    var bars = c.levers.map(function (l) { return '<div class="bar"><div class="lbl"><span>' + esc(l.label) + '</span><b>' + m(l.value) + '</b></div><div class="trk"><div class="fill" style="width:' + (100 * l.value / max).toFixed(1) + '%"></div></div></div>'; }).join('');
    var k = S.eng.kpis();
    return '<div class="g2"><div class="card"><h2>Illustrative value model</h2><div class="illus">Illustrative only. Every input is an assumption for the CIO to replace with the operator\u2019s baselines. Annual run-rate benefit at full scale; licences and change costs are not netted off beyond the AI run cost per automated contact.</div><div class="seg" style="margin-bottom:10px">' + segs + '</div><div class="calc">' + inputs + '</div>' +
      '<div class="big"><div><b id="calc-total">' + m(c.total) + '</b><small>Total annual benefit</small></div><div><b>' + (c.contacts / 1e6).toFixed(1) + 'm</b><small>Assisted contacts per year</small></div><div><b>' + m(c.costToServe) + '</b><small>Of which cost to serve</small></div></div>' + bars + '</div>' +
      '<div class="card"><h2>Live evidence from the working model</h2><p class="small muted">These tiles update as you run journeys. They show the mechanisms behind each value lever working end to end on mock data, not forecast benefits.</p><div class="kpis" style="flex-wrap:wrap;padding:0;border:0">' + k.map(function (x) { return '<div class="kpi"><b>' + esc(x.value) + '</b><small>' + esc(x.label) + '</small></div>'; }).join('') + '</div>' +
      '<table class="t" style="margin-top:10px"><tr><th>Board outcome</th><th>Proved in the demo by</th></tr><tr><td>Lower cost to serve</td><td>Bill-shock journey resolved end to end by agents; contacts resolved and credits auto-applied</td></tr><tr><td>Protect revenue</td><td>Consented retention offer via TMF680/TMF679/TMF622</td></tr><tr><td>Grow B2B</td><td>TMF921 probe catches infeasible sites before quoting (order fallout avoided)</td></tr><tr><td>Resilience and trust</td><td>Guardrail hits, human escalations, PII masking, hash-chained audit, eval pass rate</td></tr></table>' +
      '<h3>Decisions for the CIO</h3><ol class="small"><li>Sponsor the 90-day, two-journey pilot</li><li>Grant TMF API sandbox access or approve facades</li><li>Approve trust-policy thresholds (credit cap, autonomy list)</li><li>Name a CTO owner for the TMF921 intent handler</li><li>Choose the approved staff surfaces (Slack, Coworker, Claude)</li></ol></div></div>';
  }

  /* ---------- API explorer ---------- */
  function apiTab() {
    var tools = S.eng.tools(), t = tools.filter(function (x) { return x.name === S.apiTool; })[0];
    var opts = tools.map(function (x) { return '<option value="' + x.name + '"' + (x.name === S.apiTool ? ' selected' : '') + '>' + x.tmf + ' \u00b7 ' + x.name + '</option>'; }).join('');
    var ag = Object.keys(IB.AGENTS).map(function (a) { return '<option value="' + a + '"' + (a === S.apiAgent ? ' selected' : '') + '>' + esc(IB.AGENTS[a].name) + '</option>'; }).join('');
    var res = S.apiResult;
    return '<div class="g2"><div class="card"><h2>TMF Open API explorer (in-browser mock)</h2><p class="small muted">Calls go through the Agent Fabric gateway as the selected agent, so scope, policy, masking and audit all apply.</p><label class="small">Operation<br><select id="api-tool" style="width:100%">' + opts + '</select></label><p class="small"><b>' + esc(t.tmf + ' ' + t.title) + '</b> \u00b7 ODA: ' + esc(t.oda) + ' \u00b7 SoR: ' + esc(t.system) + '<br>' + esc(t.description) + '</p><label class="small">Arguments (JSON)<textarea id="api-args" rows="7">' + esc(JSON.stringify(S.apiArgs || t.sample, null, 2)) + '</textarea></label><div class="row" style="margin-top:6px"><label class="small">Call as <select id="api-agent">' + ag + '</select></label><button class="btn" id="btn-api">Send</button><label class="small"><input type="checkbox" id="api-raw"' + (S.apiRaw ? ' checked' : '') + '> show system-of-record view (unmasked, admin only)</label></div></div>' +
      '<div class="card"><h2>Response</h2>' + (res ? '<div class="row small"><span class="pill p-' + res.decision + '">' + res.decision + '</span><b>' + (res.response && res.response.status) + '</b><span class="mono">' + esc(res.method + ' ' + res.path) + '</span><span class="muted">' + esc(res.rule + ': ' + res.reason) + '</span></div><pre class="json" id="api-out" style="border-radius:7px;margin-top:6px;max-height:520px">' + J(S.apiRaw && res.raw ? res.raw : res.response) + '</pre>' : '<p class="muted small">Send a request to see real-shaped TMF JSON.</p>') + '</div></div>';
  }

  /* ---------- Render & events ---------- */
  function render() {
    var q = S.eng.queue.filter(function (x) { return x.status === 'pending'; }).length;
    $('#qcount').textContent = q ? String(q) : ''; $('#qcount').style.display = q ? '' : 'none';
    $('#kpis').innerHTML = kpiHtml();
    document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === S.tab); });
    var surfScroll = $('#surface') ? $('#surface').scrollTop : null;
    var html = { demo: demoTab, fabric: fabricTab, queue: queueTab, evals: evalsTab, cio: cioTab, api: apiTab }[S.tab]();
    var t = $('#tab'); t.innerHTML = html; t.dataset.tab = S.tab;
    var sf = $('#surface'); if (sf) sf.scrollTop = sf.scrollHeight;
    var sq = $('#seq'); if (sq) sq.scrollTop = sq.scrollHeight;
    void surfScroll;
  }
  function ensureRunner() {
    if (!S.runner || S.runner.journey.id !== S.scen || S.runner.status === 'done' || S.runner.status === 'halted') {
      if (S.runner && S.runner.journey.id === S.scen && (S.runner.status === 'done' || S.runner.status === 'halted')) return S.runner;
      S.runner = S.eng.start(S.scen, Object.assign({}, S.params));
      var first = { b2b: 'claude', consumer: S.eng.customer(S.params.customer).contactChannel === 'phone' ? 'coworker' : 'customer', noc: 'slack', field: 'coworker', product: 'slack', care: 'customer' }[S.scen];
      S.surface = first;
    }
    return S.runner;
  }
  function stepSurfaceFollow() {
    // follow the surface of the latest message for this run
    var latest = null;
    Object.keys(S.eng.surfaces).forEach(function (k) { var a = S.eng.surfaces[k]; var m = a[a.length - 1]; if (m && m.run === S.runner.id && (!latest || m.id > latest.m.id)) latest = { k: k, m: m }; });
    if (latest) S.surface = latest.k;
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button,[data-tool],li[data-step]'); if (!b) return;
    if (b.dataset.tab) { S.tab = b.dataset.tab; render(); return; }
    if (b.dataset.scen) { S.scen = b.dataset.scen; render(); return; }
    if (b.dataset.surf) { S.surface = b.dataset.surf; render(); return; }
    if (b.id === 'btn-step') { var r = ensureRunner(); if (r.status === 'done' || r.status === 'halted') { S.runner = null; r = ensureRunner(); } r.step(); stepSurfaceFollow(); render(); return; }
    if (b.id === 'btn-run') { var r2 = ensureRunner(); r2.runAll(); stepSurfaceFollow(); render(); return; }
    if (b.id === 'btn-restart') { S.runner = S.eng.start(S.scen, Object.assign({}, S.params)); render(); return; }
    if (b.id === 'btn-reset') { newEngine(); S.lastKpi = {}; render(); return; }
    if (b.id === 'btn-ask') {
      var text = $('#ask').value || ''; var rt = S.eng.route(text);
      S.askOut = rt.blocked ? '<span class="bad"><b>Blocked:</b> ' + esc(rt.reason) + '. Logged to the audit chain.</span>' : rt.scenario ? 'Routed to <b>' + esc(rt.agentName) + '</b> (confidence ' + rt.confidence.toFixed(2) + '). Scenario selected.' : '<span class="muted">' + esc(rt.reason) + '</span>';
      if (rt.scenario) { S.scen = rt.scenario; S.runner = null; }
      render(); return;
    }
    if (b.dataset.approve || b.dataset.reject) {
      var id = b.dataset.approve || b.dataset.reject;
      if (b.dataset.approve) S.eng.approve(id, S.supervisor); else S.eng.reject(id, S.supervisor, 'Rejected by supervisor');
      S.eng.runs.forEach(function (r3) { if (r3.waitingOn === id) r3.step(); });
      render(); return;
    }
    if (b.dataset.tool) { S.selTool = b.dataset.tool; render(); return; }
    if (b.id === 'btn-verify') { render(); return; }
    if (b.id === 'btn-tamper') { S.eng.tamperAudit(1); render(); return; }
    if (b.id === 'btn-evals') { S.eng.runEvals(); render(); return; }
    if (b.dataset.preset) { S.preset = b.dataset.preset; Object.keys(IB.PRESETS[S.preset]).forEach(function (k) { S.calc[k] = IB.PRESETS[S.preset][k]; }); render(); return; }
    if (b.id === 'btn-api') {
      var args; try { args = JSON.parse($('#api-args').value); } catch (e) { alert('Arguments are not valid JSON'); return; }
      S.apiArgs = args; S.apiAgent = $('#api-agent').value;
      try { S.apiResult = S.eng.invoke(S.apiAgent, S.apiTool, args); } catch (e) { S.apiResult = { decision: 'deny', rule: 'ERROR', reason: e.message, method: '', path: '', response: { status: 400, body: { reason: e.message } } }; }
      render(); return;
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id && t.id.indexOf('param-') === 0) { S.params[t.id.slice(6)] = t.value; S.runner = null; render(); }
    else if (t.dataset.calc) { S.calc[t.dataset.calc] = t.value; S.preset = ''; render(); }
    else if (t.id === 'pol-cap') S.eng.policy.autoCreditCap = parseFloat(t.value) || 0;
    else if (t.id === 'pol-sim') S.eng.policy.simSwapThreshold = parseFloat(t.value) || 0;
    else if (t.id === 'pol-disc') S.eng.policy.discountAuthorityPct = parseFloat(t.value) || 0;
    else if (t.id === 'sup-name') S.supervisor = t.value;
    else if (t.id === 'api-tool') { S.apiTool = t.value; S.apiArgs = null; S.apiResult = null; render(); }
    else if (t.id === 'api-agent') S.apiAgent = t.value;
    else if (t.id === 'api-raw') { S.apiRaw = t.checked; render(); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.id === 'ask') $('#btn-ask').click(); });
  newEngine(); render();
})();
