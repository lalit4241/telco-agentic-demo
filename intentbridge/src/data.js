/* IntentBridge seed data: a fictional UK tier-1 operator ("Albion Telecom").
   All people, companies, numbers and addresses are invented for demo purposes. */
(function (root) {
  function seed() {
    var customers = [
      { id: 'CUST-1001', type: 'Individual', givenName: 'Sarah', familyName: 'Mitchell', email: 'sarah.mitchell@example.co.uk', phone: '07700 900123', street: '14 Cardigan Road', city: 'Leeds', postcode: 'LS6 3AB', dateOfBirth: '1988-04-12', segment: 'Consumer', tenureMonths: 52, vulnerability: null, simSwapDate: '2025-02-10', iccid: '8944100000000001234', churnRisk: 0.62, billingAccount: 'BA-55001', contactChannel: 'app' },
      { id: 'CUST-1002', type: 'Individual', givenName: 'Arthur', familyName: 'Bennett', email: 'a.bennett@example.co.uk', phone: '07700 900456', street: '3 Ash Grove', city: 'Leeds', postcode: 'LS6 1HD', dateOfBirth: '1946-09-30', segment: 'Consumer', tenureMonths: 140, vulnerability: { category: 'Bereavement', need: 'Prefers phone contact; needs extra time', recorded: '2026-09-02' }, simSwapDate: '2021-06-01', iccid: '8944100000000004567', churnRisk: 0.35, billingAccount: 'BA-55002', contactChannel: 'phone' },
      { id: 'CUST-1003', type: 'Individual', givenName: 'Priya', familyName: 'Shah', email: 'priya.shah@example.co.uk', phone: '07700 900789', street: '88 Otley Road', city: 'Leeds', postcode: 'LS6 4BA', dateOfBirth: '1993-01-21', segment: 'Consumer', tenureMonths: 18, vulnerability: null, simSwapDate: '2026-10-23', iccid: '8944100000000007890', churnRisk: 0.48, billingAccount: 'BA-55003', contactChannel: 'app' },
      { id: 'CUST-1004', type: 'Individual', givenName: 'David', familyName: 'Okafor', email: 'd.okafor@example.co.uk', phone: '07700 900321', street: '27 Wilbraham Road', city: 'Manchester', postcode: 'M14 6JS', dateOfBirth: '1979-11-03', segment: 'Consumer', tenureMonths: 96, vulnerability: null, simSwapDate: '2024-03-15', iccid: '8944100000000003210', churnRisk: 0.71, billingAccount: 'BA-55004', contactChannel: 'app' },
      { id: 'ORG-2001', type: 'Organization', tradingName: 'Northwind Logistics Ltd', companyNumber: '09876543', email: 'it.procurement@northwind-logistics.example', phone: '0113 496 0000', street: 'Northwind House, Thorpe Park', city: 'Leeds', postcode: 'LS15 8ZB', segment: 'Enterprise', tenureMonths: 64, vulnerability: null, churnRisk: 0.22, billingAccount: 'BA-90001', accountManager: 'James Whitaker', contactChannel: 'account-manager' }
    ];

    function bill(id, acct, period, lines, state) {
      var total = lines.reduce(function (s, l) { return s + l.amount; }, 0);
      return { id: id, billingAccount: acct, period: period, state: state || 'settled', lines: lines, total: Math.round(total * 100) / 100 };
    }
    var bills = [
      bill('BILL-55001-09', 'BA-55001', ['2026-09-01', '2026-09-30'], [
        { type: 'recurring', label: 'Full Fibre 500 broadband', amount: 45.00, product: 'PI-1001-BB' },
        { type: 'recurring', label: 'SIM Only 10GB plan', amount: 18.00, product: 'PI-1001-MOB' }]),
      bill('BILL-55001-10', 'BA-55001', ['2026-10-01', '2026-10-31'], [
        { type: 'recurring', label: 'Full Fibre 500 broadband', amount: 45.00, product: 'PI-1001-BB' },
        { type: 'recurring', label: 'SIM Only 10GB plan', amount: 18.00, product: 'PI-1001-MOB' },
        { type: 'usage', label: 'Data top-up 5GB (auto) x3, 3-7 Oct', amount: 30.00, product: 'PI-1001-MOB', usageWindow: ['2026-10-03', '2026-10-07'] },
        { type: 'usage', label: 'Out-of-bundle data 1.6GB @ £5/GB, 6-7 Oct', amount: 8.00, product: 'PI-1001-MOB', usageWindow: ['2026-10-06', '2026-10-07'] }], 'new'),
      bill('BILL-55002-09', 'BA-55002', ['2026-09-01', '2026-09-30'], [
        { type: 'recurring', label: 'Full Fibre 150 broadband', amount: 32.00, product: 'PI-1002-BB' },
        { type: 'recurring', label: 'Landline anytime calls', amount: 12.00, product: 'PI-1002-VOICE' }]),
      bill('BILL-55002-10', 'BA-55002', ['2026-10-01', '2026-10-31'], [
        { type: 'recurring', label: 'Full Fibre 150 broadband', amount: 32.00, product: 'PI-1002-BB' },
        { type: 'recurring', label: 'Landline anytime calls', amount: 12.00, product: 'PI-1002-VOICE' },
        { type: 'usage', label: 'Mobile calls to 07 numbers outside bundle, 3-7 Oct', amount: 31.00, product: 'PI-1002-VOICE', usageWindow: ['2026-10-03', '2026-10-07'] }], 'new'),
      bill('BILL-55003-09', 'BA-55003', ['2026-09-01', '2026-09-30'], [
        { type: 'recurring', label: 'Full Fibre 150 broadband', amount: 30.00, product: 'PI-1003-BB' },
        { type: 'recurring', label: 'SIM Only 30GB plan', amount: 22.00, product: 'PI-1003-MOB' }]),
      bill('BILL-55003-10', 'BA-55003', ['2026-10-01', '2026-10-31'], [
        { type: 'recurring', label: 'Full Fibre 150 broadband', amount: 30.00, product: 'PI-1003-BB' },
        { type: 'recurring', label: 'SIM Only 30GB plan', amount: 22.00, product: 'PI-1003-MOB' },
        { type: 'usage', label: 'Data top-up 10GB (auto) x2', amount: 24.00, product: 'PI-1003-MOB', usageWindow: ['2026-10-04', '2026-10-06'] }], 'new'),
      bill('BILL-55004-09', 'BA-55004', ['2026-09-01', '2026-09-30'], [
        { type: 'recurring', label: 'Full Fibre 900 broadband', amount: 55.00, product: 'PI-1004-BB' },
        { type: 'recurring', label: 'SIM Only Unlimited calls 5GB', amount: 15.00, product: 'PI-1004-MOB' }]),
      bill('BILL-55004-10', 'BA-55004', ['2026-10-01', '2026-10-31'], [
        { type: 'recurring', label: 'Full Fibre 900 broadband', amount: 55.00, product: 'PI-1004-BB' },
        { type: 'recurring', label: 'SIM Only Unlimited calls 5GB', amount: 15.00, product: 'PI-1004-MOB' },
        { type: 'usage', label: 'Data top-up 5GB (auto) x5, 9-14 Oct', amount: 50.00, product: 'PI-1004-MOB', usageWindow: ['2026-10-09', '2026-10-14'] },
        { type: 'usage', label: 'Out-of-bundle data 4.5GB @ £5/GB, 13-14 Oct', amount: 22.50, product: 'PI-1004-MOB', usageWindow: ['2026-10-13', '2026-10-14'] }], 'new')
    ];

    var productInventory = [
      { id: 'PI-1001-BB', customer: 'CUST-1001', offering: 'PO-FF500', name: 'Full Fibre 500', status: 'active', startDate: '2022-06-01', serviceId: 'SVC-FTTP-1001', place: 'LS6 3AB', changes: [] },
      { id: 'PI-1001-MOB', customer: 'CUST-1001', offering: 'PO-SIM10', name: 'SIM Only 10GB', status: 'active', startDate: '2023-01-15', serviceId: 'SVC-MOB-1001', changes: [{ date: '2026-08-01', change: 'Auto top-up enabled (default on plan renewal)' }] },
      { id: 'PI-1002-BB', customer: 'CUST-1002', offering: 'PO-FF150', name: 'Full Fibre 150', status: 'active', startDate: '2015-03-01', serviceId: 'SVC-FTTP-1002', place: 'LS6 1HD', changes: [] },
      { id: 'PI-1002-VOICE', customer: 'CUST-1002', offering: 'PO-VOICE', name: 'Digital landline', status: 'active', startDate: '2015-03-01', serviceId: 'SVC-VOIP-1002', changes: [] },
      { id: 'PI-1003-BB', customer: 'CUST-1003', offering: 'PO-FF150', name: 'Full Fibre 150', status: 'active', startDate: '2025-04-01', serviceId: 'SVC-FTTP-1003', place: 'LS6 4BA', changes: [] },
      { id: 'PI-1003-MOB', customer: 'CUST-1003', offering: 'PO-SIM30', name: 'SIM Only 30GB', status: 'active', startDate: '2025-04-01', serviceId: 'SVC-MOB-1003', changes: [{ date: '2026-10-23', change: 'SIM replaced (eSIM transfer requested in app)' }] },
      { id: 'PI-1004-BB', customer: 'CUST-1004', offering: 'PO-FF900', name: 'Full Fibre 900', status: 'active', startDate: '2018-10-01', serviceId: 'SVC-FTTP-1004', place: 'M14 6JS', changes: [] },
      { id: 'PI-1004-MOB', customer: 'CUST-1004', offering: 'PO-SIM5', name: 'SIM Only Unlimited calls 5GB', status: 'active', startDate: '2020-02-01', serviceId: 'SVC-MOB-1004', changes: [] }
    ];

    var offerings = [
      { id: 'PO-SDWAN-PREM', name: 'SD-WAN Premium (managed, per site)', category: 'B2B Connectivity', price: { recurring: 420, oneOff: 950 }, spec: 'CFS-SDWAN', segment: 'Enterprise', bundleRules: ['Requires an access circuit per site', 'Eligible for 5G slice backup'] },
      { id: 'PO-SDWAN-STD', name: 'SD-WAN Standard (per site)', category: 'B2B Connectivity', price: { recurring: 260, oneOff: 650 }, spec: 'CFS-SDWAN', segment: 'Enterprise', bundleRules: ['Best-effort backup only'] },
      { id: 'PO-5G-SLICE-BKP', name: '5G Network Slice backup (eMBB, SLA-backed)', category: 'B2B Mobility', price: { recurring: 85, oneOff: 120 }, spec: 'CFS-5G-SLICE', segment: 'Enterprise', bundleRules: ['Add-on to SD-WAN Premium only'] },
      { id: 'PO-ETH-DIVERSE', name: 'Diverse Ethernet second circuit (100Mbps)', category: 'B2B Connectivity', price: { recurring: 310, oneOff: 1500 }, spec: 'CFS-ETHERNET', segment: 'Enterprise', bundleRules: ['Lead time 45-60 working days'] },
      { id: 'PO-FF500', name: 'Full Fibre 500', category: 'Broadband', price: { recurring: 45 }, segment: 'Consumer' },
      { id: 'PO-SIM10', name: 'SIM Only 10GB', category: 'Mobile', price: { recurring: 18 }, segment: 'Consumer' },
      { id: 'PO-RET-UNL3', name: 'Loyalty: Unlimited data for 3 months at no extra cost', category: 'Retention', price: { recurring: 0 }, segment: 'Consumer', eligibility: { minTenureMonths: 12, minChurnRisk: 0.5, requiresProduct: 'Mobile' } },
      { id: 'PO-RET-5OFF', name: 'Loyalty: £5 off broadband for 12 months', category: 'Retention', price: { recurring: -5 }, segment: 'Consumer', eligibility: { minTenureMonths: 24, minChurnRisk: 0.3, requiresProduct: 'Broadband' } },
      { id: 'PO-RET-BOOST', name: 'Speed boost to Full Fibre 900 at current price', category: 'Retention', price: { recurring: 0 }, segment: 'Consumer', eligibility: { minTenureMonths: 60, minChurnRisk: 0.6, requiresProduct: 'Broadband' } }
    ];

    var serviceCatalog = [
      { id: 'CFS-SDWAN', name: 'Managed SD-WAN CFS', slaRange: { availability: [99.5, 99.99], latencyMs: [20, 60] }, dependsOn: ['RFS-ACCESS', 'RFS-SDWAN-EDGE'] },
      { id: 'CFS-5G-SLICE', name: '5G eMBB network slice CFS (backup)', slaRange: { availability: [99.0, 99.5], latencyMs: [25, 50] }, dependsOn: ['RFS-5G-CORE-SLICE', 'RFS-RAN-CELL'] },
      { id: 'CFS-ETHERNET', name: 'Ethernet access CFS', slaRange: { availability: [99.9, 99.95], latencyMs: [5, 15] }, dependsOn: ['RFS-FIBRE-TAIL'] }
    ];

    // 40 Northwind Logistics sites: [siteId, name, postcode, primary access, 5G region]
    var siteRows = [
      ['S01','Leeds HQ','LS15 8ZB','ETHERNET','YH-URBAN'],['S02','Leeds DC','LS10 1JR','ETHERNET','YH-URBAN'],['S03','Bradford Depot','BD4 6SG','ETHERNET','YH-URBAN'],['S04','Wakefield Hub','WF2 0XQ','ETHERNET','YH-URBAN'],
      ['S05','Sheffield DC','S9 1XU','ETHERNET','YH-URBAN'],['S06','Hull Port Depot','HU9 5PQ','FTTP','YH-URBAN'],['S07','York Depot','YO26 6RS','FTTP','YH-URBAN'],['S08','Manchester Trafford','M17 1PZ','ETHERNET','NW-URBAN'],
      ['S09','Manchester Airport','M90 5XX','ETHERNET','NW-URBAN'],['S10','Liverpool Docks','L20 1BX','ETHERNET','NW-URBAN'],['S11','Preston Depot','PR2 5AL','FTTP','NW-URBAN'],['S12','Warrington DC','WA5 7TY','ETHERNET','NW-URBAN'],
      ['S13','Carlisle Depot','CA1 3NQ','FTTP','NW-RURAL'],['S14','Newcastle DC','NE11 0QD','ETHERNET','NE-URBAN'],['S15','Teesside Hub','TS6 6UD','ETHERNET','NE-URBAN'],['S16','Birmingham DC','B6 7EU','ETHERNET','MID-URBAN'],
      ['S17','Coventry Hub','CV3 4FJ','ETHERNET','MID-URBAN'],['S18','Daventry DIRFT','NN6 7GX','ETHERNET','MID-URBAN'],['S19','Nottingham Depot','NG2 1NB','FTTP','MID-URBAN'],['S20','Leicester DC','LE19 1WP','ETHERNET','MID-URBAN'],
      ['S21','Stoke Depot','ST4 4EG','FTTP','MID-URBAN'],['S22','London Park Royal','NW10 7NY','ETHERNET','LDN'],['S23','London Dagenham','RM9 6SA','ETHERNET','LDN'],['S24','Heathrow Cargo','TW6 3FX','ETHERNET','LDN'],
      ['S25','Thurrock DC','RM20 3LP','ETHERNET','LDN'],['S26','Dartford Hub','DA1 5PZ','ETHERNET','LDN'],['S27','Southampton Port','SO15 1HA','ETHERNET','SOUTH'],['S28','Portsmouth Depot','PO3 5PR','FTTP','SOUTH'],
      ['S29','Bristol Avonmouth','BS11 8DE','ETHERNET','SW-URBAN'],['S30','Exeter Depot','EX2 7HY','FTTP','SW-URBAN'],['S31','Truro Depot','TR4 9LD','FTTC','SW-RURAL'],['S32','Cardiff DC','CF3 2EE','ETHERNET','WALES'],
      ['S33','Swansea Depot','SA7 9EH','FTTP','WALES'],['S34','Glasgow DC','G33 4UL','ETHERNET','SCOT-URBAN'],['S35','Edinburgh Hub','EH28 8PL','ETHERNET','SCOT-URBAN'],['S36','Aberdeen Depot','AB21 0GW','FTTP','SCOT-URBAN'],
      ['S37','Inverness Depot','IV2 7XB','FTTC','SCOT-HIGHLANDS'],['S38','Belfast Harbour','BT3 9JQ','ETHERNET','NI'],['S39','Norwich Depot','NR6 6EP','FTTP','EAST'],['S40','Felixstowe Port','IP11 4SH','ETHERNET','EAST']
    ];
    var sites = siteRows.map(function (r) { return { id: 'NW-' + r[0], name: r[1], postcode: r[2], access: r[3], region: r[4] }; });

    // 5G RAN cells / slice capacity per region (TMF639 resource inventory)
    var cells = [
      { id: 'RAN-YH-URBAN', region: 'YH-URBAN', coverage: 'high', sliceCapacityPct: 38 },
      { id: 'RAN-NW-URBAN', region: 'NW-URBAN', coverage: 'high', sliceCapacityPct: 44 },
      { id: 'RAN-NW-RURAL', region: 'NW-RURAL', coverage: 'medium', sliceCapacityPct: 96 },
      { id: 'RAN-NE-URBAN', region: 'NE-URBAN', coverage: 'high', sliceCapacityPct: 31 },
      { id: 'RAN-MID-URBAN', region: 'MID-URBAN', coverage: 'high', sliceCapacityPct: 52 },
      { id: 'RAN-LDN', region: 'LDN', coverage: 'high', sliceCapacityPct: 61 },
      { id: 'RAN-SOUTH', region: 'SOUTH', coverage: 'high', sliceCapacityPct: 40 },
      { id: 'RAN-SW-URBAN', region: 'SW-URBAN', coverage: 'medium', sliceCapacityPct: 47 },
      { id: 'RAN-SW-RURAL', region: 'SW-RURAL', coverage: 'none', sliceCapacityPct: 0 },
      { id: 'RAN-WALES', region: 'WALES', coverage: 'medium', sliceCapacityPct: 35 },
      { id: 'RAN-SCOT-URBAN', region: 'SCOT-URBAN', coverage: 'high', sliceCapacityPct: 29 },
      { id: 'RAN-SCOT-HIGHLANDS', region: 'SCOT-HIGHLANDS', coverage: 'none', sliceCapacityPct: 0 },
      { id: 'RAN-NI', region: 'NI', coverage: 'medium', sliceCapacityPct: 42 },
      { id: 'RAN-EAST', region: 'EAST', coverage: 'high', sliceCapacityPct: 36 }
    ];

    var serviceInventory = [
      { id: 'SVC-FTTP-1001', name: 'FTTP access LS6 3AB', state: 'active', supportingResource: 'OLT-LDS-HDY-03' },
      { id: 'SVC-FTTP-1002', name: 'FTTP access LS6 1HD', state: 'active', supportingResource: 'OLT-LDS-HDY-03' },
      { id: 'SVC-FTTP-1003', name: 'FTTP access LS6 4BA', state: 'active', supportingResource: 'OLT-LDS-HDY-03' },
      { id: 'SVC-FTTP-1004', name: 'FTTP access M14 6JS', state: 'active', supportingResource: 'CAB-MAN-FWD-17' },
      { id: 'SVC-MOB-1001', name: 'Mobile 07700900123', state: 'active' },
      { id: 'SVC-MOB-1003', name: 'Mobile 07700900789', state: 'active' }
    ];

    var resources = [
      { id: 'OLT-LDS-HDY-03', type: 'OLT line card', location: 'Headingley exchange, Leeds', state: 'operational', serves: ['LS6'] },
      { id: 'CAB-MAN-FWD-17', type: 'Street cabinet power unit', location: 'Fallowfield, Manchester', state: 'operational', serves: ['M14'] },
      { id: 'RTR-MAN-AGG-02', type: 'Aggregation router', location: 'Manchester Trafford Park PoP', state: 'operational', serves: ['M17', 'M90'] }
    ].concat(cells.map(function (c) { return { id: c.id, type: '5G RAN cluster', location: c.region, state: 'operational', coverage: c.coverage, sliceCapacityPct: c.sliceCapacityPct }; }));

    var alarms = [
      { id: 'ALM-55120', resource: 'OLT-LDS-HDY-03', severity: 'critical', type: 'equipmentAlarm', probableCause: 'Line card failure', raised: '2026-10-03T08:12:00Z', cleared: '2026-10-07T17:40:00Z', state: 'cleared' },
      { id: 'ALM-55190', resource: 'CAB-MAN-FWD-17', severity: 'major', type: 'powerAlarm', probableCause: 'Mains power failure, battery exhausted', raised: '2026-10-09T06:30:00Z', cleared: '2026-10-14T12:05:00Z', state: 'cleared' }
    ];

    var serviceProblems = [
      { id: 'SP-7781', name: 'FTTP outage Headingley (LS6)', status: 'resolved', impactedAreas: ['LS6'], rootCause: 'OLT line card failure', alarms: ['ALM-55120'], start: '2026-10-03T08:12:00Z', end: '2026-10-07T17:40:00Z', affectedCustomers: 1140 },
      { id: 'SP-7790', name: 'FTTP/FTTC outage Fallowfield (M14)', status: 'resolved', impactedAreas: ['M14'], rootCause: 'Cabinet mains power failure', alarms: ['ALM-55190'], start: '2026-10-09T06:30:00Z', end: '2026-10-14T12:05:00Z', affectedCustomers: 420 }
    ];

    var appointments = [
      { id: 'APT-3301', serviceOrder: 'SO-9001', site: 'NW-S31', engineer: 'Tom Hargreaves', engineerPhone: '07700 900555', slot: { start: '2026-10-27T08:00:00Z', end: '2026-10-27T12:00:00Z' }, status: 'confirmed', note: 'Install diverse Ethernet NTE' }
    ];

    return {
      customers: customers, bills: bills, productInventory: productInventory, offerings: offerings,
      serviceCatalog: serviceCatalog, sites: sites, cells: cells, serviceInventory: serviceInventory,
      resources: resources, alarms: alarms, serviceProblems: serviceProblems, appointments: appointments,
      adjustments: [], intents: [], intentReports: [], quotes: [], productOrders: [],
      serviceOrders: [{ id: 'SO-9001', externalId: 'NW-S31-ETH', state: 'acknowledged', category: 'B2B install', site: 'NW-S31', appointment: 'APT-3301',
        items: [{ id: '1', action: 'add', state: 'acknowledged', service: 'CFS-ETHERNET', label: 'Install diverse Ethernet NTE, Truro Depot' }] }],
      troubleTickets: [], recommendations: [], qualifications: []
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = seed; else root.IBseed = seed;
})(typeof self !== 'undefined' ? self : this);
