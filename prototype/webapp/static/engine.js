/* JavaScript port of the telco_agentic engine + webapp.core, for the serverless single-file build.
 * Behaviour mirrors the Python package exactly (checked by tests/test_js_engine.py, which runs both
 * and compares outputs). Seed data, scenarios, keywords and policy thresholds are injected from Python
 * at build time (build_static.py) so there is one source of truth for data. */
(function (root) {
  "use strict";
  const clone = (o) => (o === undefined ? null : JSON.parse(JSON.stringify(o)));
  const pad = (n, w) => String(n).padStart(w, "0");
  const f2 = (x) => Number(x).toFixed(2);
  const pyList = (a) => "[" + a.map((x) => `'${x}'`).join(", ") + "]";

  class ApiError extends Error { constructor(status, detail) { super(detail); this.status = status; this.detail = detail; } }
  class NotFound extends Error { constructor(m) { super(m); this.name = "NotFound"; } }
  class ToolDenied extends Error { constructor(m) { super(m); this.name = "ToolDenied"; } }

  function create(D) {
    const G = D.policy;

    // ---------------- TMF stubs ----------------
    function seed() {
      const s = clone(D.seed);
      const ids = (p) => { let c = 0; return () => `${p}-${pad(++c, 5)}`; };
      const adjId = ids("ADJ"), ttId = ids("TT");
      const tickets = {};
      const api = {
        customer: {
          customers: s.customers,
          retrieve(id) { if (!(id in s.customers)) throw new NotFound(id); return clone(s.customers[id]); },
          patch(id, ch) { Object.assign(s.customers[id], ch); return api.customer.retrieve(id); },
        },
        inventory: { list_for_customer: (id) => clone(s.products.filter((p) => p.relatedParty === id)) },
        bill: {
          adjustments: [],
          latest_for_customer(id) {
            const b = Object.values(s.bills).filter((x) => x.relatedParty === id);
            if (!b.length) throw new NotFound(id);
            b.sort((a, c) => (a.billDate < c.billDate ? -1 : a.billDate > c.billDate ? 1 : 0));
            return clone(b[b.length - 1]);
          },
          create_adjustment(billId, amount, reason) {
            const adj = { id: adjId(), billId, amount: { unit: "GBP", value: -Math.abs(amount) }, reason, state: "applied" };
            api.bill.adjustments.push(adj); return adj;
          },
        },
        ticket: {
          tickets,
          create(body) { const id = ttId(); const t = { id, status: "acknowledged", ...body }; tickets[id] = t; return clone(t); },
          find_open_parent(d) {
            for (const t of Object.values(tickets))
              if (t.ticketType === "networkIncident" && t.area === d && t.status !== "resolved") return clone(t);
            return null;
          },
        },
        service_order: {
          orders: s.service_orders,
          retrieve(id) { if (!(id in s.service_orders)) throw new NotFound(id); return clone(s.service_orders[id]); },
          patch(id, ch) { Object.assign(s.service_orders[id], ch); return api.service_order.retrieve(id); },
        },
        alarm: { active_for_area: (d) => clone(s.alarms.filter((a) => a.area === d && a.state === "raised")) },
        catalog: { retention_offers: (seg) => clone(s.offerings.filter((o) => o.category === "retention" && o.eligibleSegments.includes(seg))) },
      };
      for (const t of s.seed_tickets) api.ticket.create(t);
      return api;
    }

    // ---------------- trace / humans / gateway ----------------
    class Trace {
      constructor(id) { this.session_id = id; this.events = []; }
      add(actor, kind, detail, data = {}) { this.events.push({ seq: this.events.length + 1, actor, kind, detail, data }); }
    }
    class HumanQueue {
      constructor() { this.tasks = []; }
      raise_task(queue, reason, proposed_action, context) {
        const t = { id: `HT-${pad(this.tasks.length + 1, 4)}`, queue, reason, proposed_action, context, status: "open" };
        this.tasks.push(t); return t;
      }
      open_tasks() { return this.tasks.filter((t) => t.status === "open"); }
    }
    class Gateway {
      constructor(b) {
        this.allow = {}; this.audit = []; this.tools = {};
        const T = (name, tmf, method, fn, write = false, kw = false) => (this.tools[name] = { name, tmf, method, fn, write, kw });
        T("customer.get", "TMF629", "GET", b.customer.retrieve);
        T("customer.patch", "TMF629", "PATCH", b.customer.patch, true);
        T("inventory.list", "TMF637", "GET", b.inventory.list_for_customer);
        T("bill.latest", "TMF678", "GET", b.bill.latest_for_customer);
        T("bill.adjust", "TMF678", "POST", b.bill.create_adjustment, true);
        T("ticket.create", "TMF621", "POST", b.ticket.create, true, true);
        T("ticket.findParent", "TMF621", "GET", b.ticket.find_open_parent);
        T("serviceOrder.get", "TMF641", "GET", b.service_order.retrieve);
        T("serviceOrder.patch", "TMF641", "PATCH", b.service_order.patch, true);
        T("alarm.activeForArea", "TMF642", "GET", b.alarm.active_for_area);
        T("catalog.retentionOffers", "TMF620", "GET", b.catalog.retention_offers);
      }
      grant(agent, ...names) { (this.allow[agent] = this.allow[agent] || new Set()); names.forEach((n) => this.allow[agent].add(n)); }
      call(agent, name, trace, args = [], kwargs = {}) {
        const t = this.tools[name];
        if (!t || !(this.allow[agent] && this.allow[agent].has(name))) {
          trace.add(agent, "guardrail", `DENIED tool ${name} (not in allow-list)`, { tool: name });
          this.audit.push({ agent, tool: name, allowed: false });
          throw new ToolDenied(`${agent} may not call ${name}`);
        }
        const req = { args: clone(args), body: clone(kwargs) };
        const result = t.kw ? t.fn(kwargs) : t.fn(...args);
        this.audit.push({ agent, tool: name, allowed: true, write: t.write });
        trace.add(agent, "tool", `${t.tmf} ${t.method} ${name}`, { tool: name, tmf: t.tmf, method: t.method, write: t.write, request: req, response: clone(result) });
        return result;
      }
    }

    // ---------------- guardrails / reasoner ----------------
    const injection = (text) => {
      const t = text.toLowerCase();
      for (const p of D.injection_patterns) if (new RegExp(p).test(t)) return { ok: false, reason: `prompt-injection pattern '${p}'` };
      return { ok: true };
    };
    const maskPii = (text) => D.pii_patterns.reduce((o, [label, rx]) => o.replace(new RegExp(rx, "g"), `<${label.toUpperCase()}>`), text);
    const creditOk = (a) => (a <= G.AUTO_CREDIT_LIMIT_GBP ? { ok: true } : { ok: false, reason: `credit £${f2(a)} exceeds agent authority £${f2(G.AUTO_CREDIT_LIMIT_GBP)}` });
    const simRisk = (sig, ten) => Math.min(sig.reduce((s, x) => s + (D.sim_weights[x] ?? 10), 0) + (ten < 12 ? 10 : 0), 100);
    const classify = (text) => {
      const t = text.toLowerCase();
      const found = D.intents.filter((i) => D.keywords[i].some((k) => t.includes(k)));
      const order = ["sim_swap", "network_fault", "order_fallout", "billing_dispute", "churn_risk"];
      return found.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    };
    const outcome = (agent, status, summary, actions = [], handoff = null) => ({ agent, status, summary, actions, handoff });

    // ---------------- agents ----------------
    function makeAgents(gw, humans) {
      const base = (name, sf, tools, handle) => {
        const a = { name, sf_mapping: sf, tools };
        a.call = (trace, tool, args = [], kw = {}) => gw.call(name, tool, trace, args, kw);
        a.escalate = (trace, queue, reason, proposed, ctx) => {
          const task = humans.raise_task(queue, reason, proposed, ctx);
          trace.add(name, "escalation", `-> ${queue}: ${reason} (task ${task.id}, ${task.status})`, { task: task.id, queue });
          return outcome(name, "escalated", `Handed to ${queue}: ${reason}`, [], { task: task.id, queue, proposed, decision: task.status });
        };
        a.handle = (req, trace) => handle(a, req, trace);
        gw.grant(name, ...tools);
        return a;
      };
      return {
        billing_dispute: base("BillingResolutionAgent", "Agentforce for Communications - Billing Resolution Agent",
          ["customer.get", "bill.latest", "bill.adjust"], (a, req, trace) => {
            const cust = a.call(trace, "customer.get", [req.customer_id]);
            const bill = a.call(trace, "bill.latest", [req.customer_id]);
            let disputed = null;
            for (const line of bill.lines) {
              if (line.type === "roaming" && line.plan_includes_roaming) disputed = [line, "Roaming charged although plan includes EU roaming"];
              else if (line.type === "one-off" && line.desc.toLowerCase().includes("termination")) disputed = [line, "Early termination charge disputed - contract review needed"];
            }
            if (!disputed) { trace.add(a.name, "decision", "No policy-eligible error found; explaining bill"); return outcome(a.name, "resolved", "Bill explained line by line; no error found."); }
            const [line, why] = disputed; const amount = Number(line.amount);
            trace.add(a.name, "decision", `Disputed line '${line.desc}' £${f2(amount)}: ${why}`);
            if (line.type === "one-off") return a.escalate(trace, "b2b-billing-specialists", why, `Review contract; consider waiving £${f2(amount)}`, { bill: bill.id, amount });
            if (cust.vulnerable) return a.escalate(trace, "billing-supervisors", "Vulnerable customer - human review", `Credit £${f2(amount)}`, { bill: bill.id, amount });
            const check = creditOk(amount);
            trace.add(a.name, "guardrail", `credit authority check: ${check.ok ? "PASS" : check.reason}`);
            if (!check.ok) return a.escalate(trace, "billing-supervisors", check.reason, `Credit £${f2(amount)}`, { bill: bill.id, amount });
            const adj = a.call(trace, "bill.adjust", [bill.id, amount, why]);
            return outcome(a.name, "resolved", `Credited £${f2(amount)} to next bill (${why}).`, [`adjustment ${adj.id}`]);
          }),
        order_fallout: base("OrderFalloutAgent", "Agentforce (custom) on Industries Order Management / Communications Cloud",
          ["serviceOrder.get", "serviceOrder.patch", "customer.get"], (a, req, trace) => {
            const PLAYBOOK = { ADDR_UPRN_MISMATCH: "Align install UPRN to address master and resubmit" };
            const oid = req.context.order_id;
            if (!oid) return outcome(a.name, "pending_customer", "Please provide your order reference.");
            const so = a.call(trace, "serviceOrder.get", [oid]);
            if (so.state !== "held") return outcome(a.name, "resolved", `Order ${oid} is ${so.state}; no fallout.`);
            const code = so.falloutCode ?? "UNKNOWN";
            trace.add(a.name, "decision", `Fallout code ${code}, retries=${so.retries}`);
            if (so.retries >= G.MAX_AUTO_RETRIES_FALLOUT) return a.escalate(trace, "order-management", "Retry budget exhausted", "Manual investigation with wholesale/OLO", { order: oid, code });
            if (!(code in PLAYBOOK)) return a.escalate(trace, "order-management", `No automated playbook for ${code}`, "Manual triage", { order: oid, code });
            a.call(trace, "serviceOrder.patch", [oid, { installAddress: clone(so.addressMaster), state: "inProgress", falloutCode: null, retries: so.retries + 1 }]);
            return outcome(a.name, "resolved", `Order ${oid} remediated (${PLAYBOOK[code]}) and resubmitted.`, [`patched ${oid}`]);
          }),
        network_fault: base("NetworkFaultAgent", "Agentforce Service + Network/Asset Service agent; Field Service for dispatch",
          ["customer.get", "inventory.list", "alarm.activeForArea", "ticket.findParent", "ticket.create"], (a, req, trace) => {
            const cust = a.call(trace, "customer.get", [req.customer_id]);
            const district = cust.postcode.split(/\s+/)[0];
            const services = a.call(trace, "inventory.list", [req.customer_id]);
            const svc = services.find((s) => s.name.includes("Fibre")) || services[0];
            const alarms = a.call(trace, "alarm.activeForArea", [district]);
            if (alarms.length) {
              const al = alarms[0];
              const parent = a.call(trace, "ticket.findParent", [district]);
              const child = a.call(trace, "ticket.create", [], { ticketType: "customerFault", relatedParty: req.customer_id, service: svc.serviceId, parentTicket: parent ? parent.id : null, area: district });
              const msg = `Known incident in ${district}: ${al.probableCause}. Estimated fix ${al.etr}. We'll text you when it's restored.`;
              trace.add(a.name, "comms", `Proactive update sent: ${msg}`);
              trace.add(a.name, "decision", "Engineer dispatch suppressed (mass outage)");
              return outcome(a.name, "resolved", msg, [`child ticket ${child.id} -> ${parent ? parent.id : "-"}`]);
            }
            const lt = "FAULT_LOCAL_LOOP";
            trace.add(a.name, "decision", `No area alarm; line test result ${lt}`);
            const t = a.call(trace, "ticket.create", [], { ticketType: "customerFault", relatedParty: req.customer_id, service: svc.serviceId, area: district, diagnosis: lt, dispatch: { product: "Field Service", slot: "next-available AM" } });
            return outcome(a.name, "resolved", "Fault confirmed on your line; an engineer appointment has been booked.", [`ticket ${t.id}`, "field service work order requested"]);
          }),
        churn_risk: base("RetentionAgent", "Agentforce Service/Sales + Data 360 churn insight + Communications Cloud EPC offers",
          ["customer.get", "inventory.list", "catalog.retentionOffers"], (a, req, trace) => {
            const cust = a.call(trace, "customer.get", [req.customer_id]);
            const offers = a.call(trace, "catalog.retentionOffers", [cust.segment]);
            if (cust.vulnerable) return a.escalate(trace, "retention-specialists", "Vulnerable customer - human retention", "Specialist call-back", { customer: req.customer_id });
            const el = offers.filter((o) => o.monthlyDiscountGBP <= G.MAX_RETENTION_DISCOUNT_GBP);
            if (!el.length) return a.escalate(trace, "retention-specialists", "No in-policy offer", "Specialist call-back", { customer: req.customer_id });
            const best = el.reduce((m, o) => (o.monthlyDiscountGBP > m.monthlyDiscountGBP || (o.monthlyDiscountGBP === m.monthlyDiscountGBP && o.id > m.id) ? o : m));
            trace.add(a.name, "decision", `Best in-policy offer ${best.id} (${best.name})`);
            return outcome(a.name, "pending_customer", `Offer presented: ${best.name} (needs your acceptance; you can still leave - we'll give you your switching code if you ask).`, [`offer ${best.id}`]);
          }),
        sim_swap: base("SimSwapFraudAgent", "Agentforce Service agent + Data 360 risk signals; Shield/Event Monitoring",
          ["customer.get", "customer.patch"], (a, req, trace) => {
            const cust = a.call(trace, "customer.get", [req.customer_id]);
            const score = simRisk(cust.riskSignals, cust.tenureMonths);
            trace.add(a.name, "guardrail", `SIM-swap risk score ${score} (block >= ${G.SIM_SWAP_RISK_BLOCK_SCORE})`);
            if (score >= G.SIM_SWAP_RISK_BLOCK_SCORE) {
              a.call(trace, "customer.patch", [req.customer_id, { simSwapHold: true }]);
              const out = a.escalate(trace, "fraud-ops", `High SIM-swap risk (${score})`, "Hold swap; in-store ID check", { customer: req.customer_id, score });
              out.status = "blocked";
              out.summary = "For your security we can't change your SIM remotely right now. Please visit a store with photo ID; our fraud team has been notified.";
              return out;
            }
            if (!req.context.otp_verified) { trace.add(a.name, "decision", "Step-up authentication required (OTP to registered device)"); return outcome(a.name, "pending_customer", "We've sent a one-time code to verify you."); }
            a.call(trace, "customer.patch", [req.customer_id, { simSwapRequested: true }]);
            return outcome(a.name, "resolved", "SIM swap scheduled after successful verification.", ["sim swap order"]);
          }),
      };
    }

    // ---------------- orchestrator ----------------
    class Orchestrator {
      constructor() {
        this.backend = seed(); this.gw = new Gateway(this.backend); this.humans = new HumanQueue();
        this.agents = makeAgents(this.gw, this.humans); this._sess = 0;
      }
      handle(req) {
        const name = "Orchestrator";
        const trace = new Trace(`S-${pad(++this._sess, 4)}`);
        const inj = injection(req.text);
        if (!inj.ok) {
          trace.add(name, "guardrail", `BLOCKED input: ${inj.reason}`);
          const t = this.humans.raise_task("security-review", inj.reason, "Review session", { customer: req.customer_id });
          trace.add(name, "escalation", `-> security-review (task ${t.id})`);
          return { trace, intents: [], outcomes: [outcome(name, "blocked", "I can't help with that request. A colleague will review it.")] };
        }
        const masked = maskPii(req.text);
        trace.add(name, "guardrail", `input screened; masked text: '${masked}'`);
        const intents = classify(masked);
        trace.add(name, "route", `intents=${pyList(intents.length ? intents : ["unknown"])} channel=${req.channel}`);
        const res = { trace, intents, outcomes: [] };
        if (!intents.length) {
          const t = this.humans.raise_task("frontline-advisors", "Intent not recognised", "Human takes over", { customer: req.customer_id, text: masked });
          trace.add(name, "escalation", `-> frontline-advisors (task ${t.id})`);
          res.outcomes.push(outcome(name, "escalated", "Connecting you to an adviser."));
          return res;
        }
        res.outcomes.push(this._dispatch(intents[0], req, trace));
        if (intents.slice(1).includes("churn_risk") && res.outcomes[0].status !== "blocked") {
          trace.add(name, "route", "secondary intent churn_risk -> RetentionAgent");
          res.outcomes.push(this._dispatch("churn_risk", req, trace));
        }
        return res;
      }
      _dispatch(intent, req, trace) {
        const a = this.agents[intent];
        trace.add("Orchestrator", "route", `${intent} -> ${a.name} [${a.sf_mapping}]`);
        let out;
        try { out = a.handle(req, trace); }
        catch (e) {
          if (!(e instanceof NotFound || e instanceof ToolDenied)) throw e;
          trace.add(a.name, "error", `${e.name}: ${e.message}`);
          return a.escalate(trace, "frontline-advisors", `Agent error: ${e.name}`, "Human takes over", { customer: req.customer_id });
        }
        trace.add(a.name, "decision", `OUTCOME ${out.status}: ${out.summary}`);
        return out;
      }
    }

    // ---------------- session (mirrors webapp/session.py) ----------------
    class Session {
      constructor() { this.orch = new Orchestrator(); this.runs = 0; this.task_run = {}; this.orch.gw.grant("SupervisorConsole", "bill.adjust", "customer.patch", "serviceOrder.patch"); }
      tasks() { return this.orch.humans.tasks.map((t) => ({ id: t.id, queue: t.queue, reason: t.reason, proposed: t.proposed_action, status: t.status, context: clone(t.context), run: this.task_run[t.id] ?? null })); }
      stats() { const a = this.orch.gw.audit; return { runs: this.runs, toolCalls: a.filter((x) => x.allowed).length, writes: a.filter((x) => x.write).length, denied: a.filter((x) => !x.allowed).length, openTasks: this.orch.humans.open_tasks().length }; }
      run(req) {
        const before = new Set(this.orch.humans.tasks.map((t) => t.id));
        const r = this.orch.handle(req); this.runs += 1;
        for (const t of this.orch.humans.tasks) if (!before.has(t.id)) this.task_run[t.id] = this.runs;
        return { run: this.runs, session: r.trace.session_id, intents: r.intents, finalStatus: r.outcomes.length ? r.outcomes[0].status : "none",
          outcomes: r.outcomes.map((o) => ({ agent: o.agent, status: o.status, summary: o.summary, actions: o.actions, handoff: clone(o.handoff) })),
          events: clone(r.trace.events), tasks: this.tasks(), stats: this.stats() };
      }
      decide(taskId, approve, note) {
        const task = this.orch.humans.tasks.find((t) => t.id === taskId);
        if (!task) throw new ApiError(404, "No such task");
        if (task.status !== "open") throw new ApiError(409, `${taskId} already ${task.status}`);
        const trace = new Trace(`${taskId}-decision`), who = "SupervisorConsole", gw = this.orch.gw, ctx = task.context;
        task.status = approve ? "approved" : "rejected";
        trace.add(who, "decision", `${task.queue}: ${task.id} ${task.status.toUpperCase()}` + (note ? ` - ${note}` : ""));
        if (approve && ["billing-supervisors", "b2b-billing-specialists"].includes(task.queue) && "bill" in ctx) {
          const adj = gw.call(who, "bill.adjust", trace, [ctx.bill, Number(ctx.amount), `Approved by ${task.queue} (${task.id})`]);
          trace.add(who, "comms", `Customer told: credit of £${f2(ctx.amount)} applied (${adj.id})`);
        } else if (task.queue === "fraud-ops" && "customer" in ctx) {
          if (approve) trace.add(who, "comms", "Hold confirmed; customer asked to visit a store with photo ID");
          else { gw.call(who, "customer.patch", trace, [ctx.customer, { simSwapHold: false }]); trace.add(who, "comms", "Hold released after fraud review; swap may proceed with OTP"); }
        } else if (task.queue === "order-management" && "order" in ctx && approve) {
          gw.call(who, "serviceOrder.patch", trace, [ctx.order, { assignedTo: "wholesale-desk", note: "Manual OLO escalation" }]);
          trace.add(who, "comms", "B2B customer updated: order with wholesale desk, next update in 24h");
        } else trace.add(who, "comms", "Decision recorded; no automated follow-up for this queue");
        return { task: this.tasks().find((t) => t.id === taskId), events: clone(trace.events), tasks: this.tasks(), stats: this.stats() };
      }
    }

    // ---------------- API (mirrors webapp/core.py) ----------------
    const sessions = new Map();
    const getS = (sid) => {
      if (!sid || !/^[A-Za-z0-9-]{8,64}$/.test(sid)) throw new ApiError(400, "Missing or invalid X-Demo-Session header");
      if (!sessions.has(sid)) sessions.set(sid, new Session());
      return sessions.get(sid);
    };
    function run(sid, body) {
      const s = getS(sid); let title, req;
      if (body.scenario !== undefined && body.scenario !== null) {
        const n = body.scenario;
        if (!Number.isInteger(n) || n < 0 || n >= D.scenarios.length) throw new ApiError(422, `scenario must be 0..${D.scenarios.length - 1}`);
        const sc = D.scenarios[n]; title = sc.title;
        req = { customer_id: sc.customer_id, text: sc.text, channel: sc.channel, context: clone(sc.context) };
      } else {
        const cid = body.customer_id, text = String(body.text || "").trim(), channel = body.channel || "chat";
        if (!cid || !text) throw new ApiError(422, "customer_id and text are required for a free-text request");
        if (text.length > 500) throw new ApiError(422, "text must be at most 500 characters");
        if (!D.channels.includes(channel)) throw new ApiError(422, `channel must be one of ${pyList(D.channels)}`);
        const ctx = {}; if (body.order_id) ctx.order_id = String(body.order_id); if (body.otp_verified) ctx.otp_verified = true;
        title = "Free-text request"; req = { customer_id: String(cid), text, channel, context: ctx };
      }
      const out = s.run(req); out.title = title; out.request = clone(req); return out;
    }
    function dispatch(method, path, bodyStr, sid) {
      try {
        const b = bodyStr ? JSON.parse(bodyStr) : {};
        let r;
        if (path === "/api/meta") r = clone(D.meta);
        else if (path === "/api/run") r = run(sid, b);
        else if (path === "/api/queue") { const s = getS(sid); r = { tasks: s.tasks(), stats: s.stats() }; }
        else if (path === "/api/reset") { getS(sid); sessions.set(sid, new Session()); const s = sessions.get(sid); r = { ok: true, tasks: s.tasks(), stats: s.stats() }; }
        else if (/^\/api\/queue\/[^/]+\/decision$/.test(path)) {
          const s = getS(sid);
          if (typeof b.approve !== "boolean") throw new ApiError(422, "approve must be true or false");
          r = s.decide(decodeURIComponent(path.split("/")[3]), b.approve, String(b.note || "").slice(0, 200));
        } else return { status: 404, body: { detail: "not found" } };
        return { status: 200, body: r };
      } catch (e) {
        if (e instanceof ApiError) return { status: e.status, body: { detail: e.detail } };
        return { status: 500, body: { detail: "Engine error: " + e.message } };
      }
    }
    return { dispatch };
  }
  root.TelcoEngine = { create };
  if (typeof module !== "undefined") module.exports = root.TelcoEngine;
})(typeof window !== "undefined" ? window : globalThis);
