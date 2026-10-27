// Mock Guidewire ClaimCenter Cloud API (shapes modelled on /claim/v1 resources: { data: { attributes, id, type, links } }).
// In-memory, synthetic, resettable. The AI harness calls this as its tools. The static demo persists the store in localStorage.
import { CLAIMS, POLICY, HANDLER } from './data.js';
import { notify } from './persist.js';

let store;
export function resetStore() {
  store = { claims: structuredClone(CLAIMS), notes: {}, activities: {}, seq: 1000 };
  for (const c of store.claims) { store.notes[c.id] = c.documents.filter(d => d.type === 'Note').map(n => ({ id: n.id, subject: n.title, body: n.text, author: n.author, createdDate: n.date, topic: 'general' })); store.activities[c.id] = []; }
  notify();
}
resetStore();
export const getStore = () => store;
export function importStore(next) { store = next; }

const BASE = '/claim/v1';
const age = (dob, at) => Math.floor((new Date(at) - new Date(dob)) / 31557600000);
const claimResource = c => ({
  id: c.id, type: 'Claim', checksum: String(c.documents.length + store.notes[c.id].length),
  attributes: {
    claimNumber: c.claimNumber, state: { code: c.status.toLowerCase(), name: c.status }, lossDate: `${c.lossDate}T00:00:00.000Z`,
    reportedDate: `${c.reportedDate}T00:00:00.000Z`, lossType: { code: 'PR', name: 'Property' }, lossCause: { code: 'waterdamage', name: c.lossType },
    lineOfBusiness: c.lob, policyNumber: c.policy.policyNumber, insured: { displayName: c.insured.name, title: c.insured.title },
    assignedUser: { displayName: c.assignedUser }, lossLocation: { displayName: c.insured.address },
    totalReserves: { amount: c.reserve, currency: 'gbp' }, totalPayments: { amount: c.paid, currency: 'gbp' }, segment: { name: c.segment },
  },
  links: { self: { href: `${BASE}/claims/${c.id}` }, documents: { href: `${BASE}/claims/${c.id}/documents` }, notes: { href: `${BASE}/claims/${c.id}/notes` } },
});

function ok(body, status = 200) { return { status, body }; }
function err(status, message) { return { status, body: { status, errorCode: status === 404 ? 'gw.api.rest.exception.NotFoundException' : 'gw.api.rest.exception.BadInputException', userMessage: message } }; }

export function apiHandle(method, path, body) {
  const url = new URL(path, 'http://x'); const p = url.pathname.replace(/\/+$/, '');
  if (!p.startsWith(BASE)) return null;
  const parts = p.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== 'claims') return err(404, 'Unknown resource');
  if (parts.length === 1 && method === 'GET') return ok({ count: store.claims.length, data: store.claims.map(claimResource), links: { self: { href: `${BASE}/claims` } } });
  const c = store.claims.find(x => x.id === parts[1] || x.claimNumber === parts[1]);
  if (!c) return err(404, `Claim ${parts[1]} not found`);
  const sub = parts[2];
  if (!sub && method === 'GET') return ok({ data: claimResource(c) });
  if (sub === 'policy' && method === 'GET') return ok({ data: { id: `pc:${c.policy.policyNumber}`, type: 'Policy', attributes: { ...c.policy, wordingId: POLICY.id, insuredAge: age(c.insured.dob, c.lossDate) } } });
  if (sub === 'contacts' && method === 'GET') return ok({ count: 1, data: [{ id: `ct:${c.id}`, type: 'ClaimContact', attributes: { displayName: c.insured.name, roles: [{ code: 'insured' }], primaryPhone: c.insured.phone, emailAddress1: c.insured.email, primaryAddress: { displayName: c.insured.address }, preferredContact: c.insured.preferredContact } }] });
  if (sub === 'exposures' && method === 'GET') return ok({ count: 2, data: [
    { id: `ex:${c.id}:1`, type: 'Exposure', attributes: { exposureType: { code: 'PropertyDamage', name: c.policy.buildingsSumInsured ? 'Buildings – escape of water' : 'Landlord fixtures – escape of water' }, coverage: { name: c.policy.buildingsSumInsured ? 'Section 1 Buildings' : 'Section 2 Contents' }, state: { code: 'open' } } },
    { id: `ex:${c.id}:2`, type: 'Exposure', attributes: { exposureType: { code: 'Content', name: 'Contents – escape of water' }, coverage: { name: 'Section 2 Contents' }, state: { code: 'open' } } }] });
  if (sub === 'documents' && method === 'GET' && !parts[3]) return ok({ count: c.documents.filter(d => d.type !== 'Note').length, data: c.documents.filter(d => d.type !== 'Note').map(d => ({ id: d.id, type: 'Document', attributes: { name: d.title, documentType: { name: d.type }, author: d.author, dateCreated: d.date } })) });
  if (sub === 'documents' && method === 'GET' && parts[3]) { const d = c.documents.find(x => x.id === parts[3]); if (!d) return err(404, 'Document not found'); return ok({ data: { id: d.id, type: 'Document', attributes: { name: d.title, documentType: { name: d.type }, author: d.author, dateCreated: d.date, contents: d.text } } }); }
  if (sub === 'photos' && method === 'GET') return ok({ count: c.photos.length, data: c.photos.map(ph => ({ id: ph.id, type: 'Document', attributes: { name: ph.caption, documentType: { name: 'Photo' }, mimeType: 'image/svg+xml (placeholder)' } })) });
  if (sub === 'notes' && method === 'GET') return ok({ count: store.notes[c.id].length, data: store.notes[c.id].map(n => ({ id: n.id, type: 'Note', attributes: n })) });
  if (sub === 'notes' && method === 'POST') {
    const a = body?.data?.attributes; if (!a || !a.body) return err(400, 'data.attributes.body is required');
    const n = { id: `cc:note-${++store.seq}`, subject: a.subject || 'Note', body: a.body, topic: a.topic?.code || 'general', author: a.author || HANDLER.displayName, createdDate: new Date().toISOString(), confidential: !!a.confidential };
    store.notes[c.id].push(n); notify(); return ok({ data: { id: n.id, type: 'Note', attributes: n } }, 201);
  }
  if (sub === 'activities' && method === 'GET') return ok({ count: store.activities[c.id].length, data: store.activities[c.id].map(a => ({ id: a.id, type: 'Activity', attributes: a })) });
  if (sub === 'activities' && method === 'POST') {
    const a = body?.data?.attributes; if (!a || !a.subject) return err(400, 'data.attributes.subject is required');
    const act = { id: `cc:act-${++store.seq}`, subject: a.subject, description: a.description || '', activityPattern: a.activityPattern || 'general_reminder', priority: a.priority || 'normal', status: 'open', assignedUser: HANDLER.displayName, createdDate: new Date().toISOString() };
    store.activities[c.id].push(act); notify(); return ok({ data: { id: act.id, type: 'Activity', attributes: act } }, 201);
  }
  return err(404, `No route for ${method} ${p}`);
}

// Full claim context (used by the UI, not part of the Cloud API surface)
export function claimDetail(id) {
  const c = store.claims.find(x => x.id === id || x.claimNumber === id); if (!c) return null;
  return { ...c, notes: store.notes[c.id], activities: store.activities[c.id], insuredAge: age(c.insured.dob, c.lossDate) };
}
