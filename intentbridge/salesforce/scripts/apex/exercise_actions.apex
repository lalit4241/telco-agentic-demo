// IntentBridge: exercise every invocable action against the seeded org data.
// Run: sf apex run --file scripts/apex/exercise_actions.apex --target-org intentbridge
Map<String, Id> acc = new Map<String, Id>();
for (Account a : [SELECT Id, IB_Customer_Id__c FROM Account WHERE IB_Customer_Id__c IN ('CUST-1001','CUST-1002','CUST-1003','CUST-1004','ORG-2001')]) { acc.put(a.IB_Customer_Id__c, a.Id); }
void out(String label, Object o) { System.debug(LoggingLevel.ERROR, 'IBX|' + label + '|' + JSON.serialize(o)); }

// 1. B2B SLA feasibility: 40 sites, 99.95%, 20 ms
IB_CheckSlaFeasibility.Request s = new IB_CheckSlaFeasibility.Request();
s.accountId = acc.get('ORG-2001'); s.siteCount = 40; s.availabilityTarget = 99.95; s.latencyMs = 20;
out('1 SLA feasibility (Northwind, 40 sites)', IB_CheckSlaFeasibility.run(new List<IB_CheckSlaFeasibility.Request>{ s })[0]);

// 2. Bill shock diagnosis for all four consumers
for (String cid : new List<String>{ 'CUST-1001', 'CUST-1004', 'CUST-1002', 'CUST-1003' }) {
    IB_DiagnoseBillShock.Request d = new IB_DiagnoseBillShock.Request(); d.accountId = acc.get(cid);
    out('2 Bill shock ' + cid, IB_DiagnoseBillShock.run(new List<IB_DiagnoseBillShock.Request>{ d })[0]);
}

// 3. Retention offer
for (String cid : new List<String>{ 'CUST-1001', 'CUST-1004' }) {
    IB_ProposeRetentionOffer.Request r = new IB_ProposeRetentionOffer.Request(); r.accountId = acc.get(cid);
    out('3 Retention ' + cid, IB_ProposeRetentionOffer.run(new List<IB_ProposeRetentionOffer.Request>{ r })[0]);
}

IB_Service_Problem__c ls6 = [SELECT Id FROM IB_Service_Problem__c WHERE Problem_Id__c = 'SP-7781'];
IB_Service_Problem__c m14 = [SELECT Id FROM IB_Service_Problem__c WHERE Problem_Id__c = 'SP-7790'];
IB_RequestCreditAdjustment.Request cr(Id a, Decimal amt, Id sp) {
    IB_RequestCreditAdjustment.Request c = new IB_RequestCreditAdjustment.Request();
    c.accountId = a; c.amount = amt; c.reason = 'Out-of-bundle data during network fault'; c.serviceProblemId = sp; c.agentName = 'Billing agent';
    return c;
}
// 4. Credit within cap (Sarah £38)
out('4 Credit £38 Sarah', IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ cr(acc.get('CUST-1001'), 38, ls6.Id) })[0]);
// 5. Credit above cap (David £72.50) then supervisor approval
IB_RequestCreditAdjustment.Result big = IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ cr(acc.get('CUST-1004'), 72.50, m14.Id) })[0];
out('5a Credit £72.50 David', big);
IB_Credit_Adjustment__c q = [SELECT Name, Status__c, Owner.Name, Owner.Type FROM IB_Credit_Adjustment__c WHERE Id = :big.creditId];
out('5b Queued record', new Map<String, Object>{ 'name' => q.Name, 'status' => q.Status__c, 'owner' => q.Owner.Name, 'ownerType' => q.Owner.Type });
IB_ApproveCredit.Request ap = new IB_ApproveCredit.Request(); ap.creditId = big.creditId; ap.approve = true; ap.comment = 'Approved: fault SP-7790 confirmed';
out('5c Supervisor approves', IB_ApproveCredit.run(new List<IB_ApproveCredit.Request>{ ap })[0]);
// 6. Vulnerable customer (Arthur £30)
out('6 Credit £30 Arthur (vulnerable)', IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ cr(acc.get('CUST-1002'), 30, ls6.Id) })[0]);
// 7. SIM-swap risk (Priya £5)
out('7 Credit £5 Priya (SIM swap)', IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ cr(acc.get('CUST-1003'), 5, null) })[0]);
// 8. Audit chain
out('8 Audit chain verify', IB_AuditService.verify());
