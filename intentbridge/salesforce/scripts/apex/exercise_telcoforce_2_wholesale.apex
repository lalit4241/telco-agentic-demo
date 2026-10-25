// Telcoforce T2: wholesale partner agent-to-agent against the seeded org data.
void out(String label, Object o) { System.debug(LoggingLevel.ERROR, 'IBX|' + label + '|' + JSON.serialize(o)); }
IB_PartnerQualify.Result q(String p, Integer n) { IB_PartnerQualify.Request r = new IB_PartnerQualify.Request(); r.partnerId = p; r.addressCount = n; return IB_PartnerQualify.run(new List<IB_PartnerQualify.Request>{ r })[0]; }
IB_PartnerOrder.Result o(String p, Integer n) { IB_PartnerOrder.Request r = new IB_PartnerOrder.Request(); r.partnerId = p; r.lines = n; return IB_PartnerOrder.run(new List<IB_PartnerOrder.Request>{ r })[0]; }
void k(String p, Boolean isOn) { IB_SetPartnerKillSwitch.Request r = new IB_SetPartnerKillSwitch.Request(); r.partnerId = p; r.isOn = isOn; r.reason = 'Kill-switch drill'; out('T2 Kill switch ' + p + ' ' + (isOn ? 'ON' : 'OFF'), IB_SetPartnerKillSwitch.run(new List<IB_SetPartnerKillSwitch.Request>{ r })[0]); }
out('T2.1 Qualify PRT-301 Brightwave x120', q('PRT-301', 120));
out('T2.2 Qualify PRT-302 QuickNet (suspended) x80', q('PRT-302', 80));
out('T2.3 Qualify PRT-303 Fibrely x300 (over daily limit)', q('PRT-303', 300));
out('T2.4 Qualify PRT-303 Fibrely x250 (within limit)', q('PRT-303', 250));
out('T2.5 Order PRT-301 x80 lines (above agreement)', o('PRT-301', 80));
out('T2.6 Order PRT-301 x25 lines', o('PRT-301', 25));
k('PRT-301', true);
out('T2.7 Qualify PRT-301 while isolated', q('PRT-301', 1));
k('PRT-301', false);
out('T2.8 Qualify PRT-301 after lift', q('PRT-301', 1));
List<Map<String, Object>> wo = new List<Map<String, Object>>();
for (IB_Wholesale_Order__c w : [SELECT Name, Partner__r.Partner_Id__c, Lines__c, Monthly_Value__c, Status__c, Decision_Rule__c, Owner.Name FROM IB_Wholesale_Order__c ORDER BY Name DESC LIMIT 2]) {
    wo.add(new Map<String, Object>{ 'name' => w.Name, 'partner' => w.Partner__r.Partner_Id__c, 'lines' => w.Lines__c, 'monthly' => w.Monthly_Value__c, 'status' => w.Status__c, 'rule' => w.Decision_Rule__c, 'owner' => w.Owner.Name });
}
out('T2.9 Wholesale orders in the org', wo);
