// Telcoforce T1: network-aware proactive care against the seeded org data.
void out(String label, Object o) { System.debug(LoggingLevel.ERROR, 'IBX|' + label + '|' + JSON.serialize(o)); }
IB_DetectOutageImpact.Request d = new IB_DetectOutageImpact.Request();
d.alarmId = 'ALM-56001'; d.resource = 'OLT-LDS-HDY-03'; d.district = 'LS6'; d.rootCause = 'OLT line card failure at Headingley exchange';
IB_DetectOutageImpact.Result imp = IB_DetectOutageImpact.run(new List<IB_DetectOutageImpact.Request>{ d })[0];
out('T1.1 Detect outage impact (ALM-56001, LS6)', imp);
IB_NotifyAffected.Request n = new IB_NotifyAffected.Request(); n.serviceProblemId = imp.serviceProblemId; n.template = 'outage-notice';
out('T1.2 Notify affected (outage-notice)', IB_NotifyAffected.run(new List<IB_NotifyAffected.Request>{ n })[0]);
out('T1.3 Notify again (duplicate guard)', IB_NotifyAffected.run(new List<IB_NotifyAffected.Request>{ n })[0]);
IB_RestoreAndCredit.Request early = new IB_RestoreAndCredit.Request(); early.serviceProblemId = imp.serviceProblemId; early.goodwill = 15; early.markResolved = false;
out('T1.4 Goodwill before restore (refused)', IB_RestoreAndCredit.run(new List<IB_RestoreAndCredit.Request>{ early })[0]);
IB_RestoreAndCredit.Request fix = new IB_RestoreAndCredit.Request(); fix.serviceProblemId = imp.serviceProblemId; fix.goodwill = 15; fix.markResolved = true;
out('T1.5 Restore and goodwill £15', IB_RestoreAndCredit.run(new List<IB_RestoreAndCredit.Request>{ fix })[0]);
IB_NotifyAffected.Request rn = new IB_NotifyAffected.Request(); rn.serviceProblemId = imp.serviceProblemId; rn.template = 'restore-notice';
out('T1.6 Notify restore', IB_NotifyAffected.run(new List<IB_NotifyAffected.Request>{ rn })[0]);
List<Map<String, Object>> notes = new List<Map<String, Object>>();
for (IB_Customer_Notification__c c : [SELECT Name, Account__r.IB_Customer_Id__c, Template__c, Channel__c, Status__c, Decision_Rule__c, Owner.Name FROM IB_Customer_Notification__c WHERE Service_Problem__c = :imp.serviceProblemId ORDER BY Name]) {
    notes.add(new Map<String, Object>{ 'name' => c.Name, 'customer' => c.Account__r.IB_Customer_Id__c, 'template' => c.Template__c, 'channel' => c.Channel__c, 'status' => c.Status__c, 'rule' => c.Decision_Rule__c, 'owner' => c.Owner.Name });
}
out('T1.7 Notifications in the org', notes);
List<Map<String, Object>> cr = new List<Map<String, Object>>();
for (IB_Credit_Adjustment__c c : [SELECT Name, Account__r.IB_Customer_Id__c, Amount__c, Status__c, Decision_Rule__c, Owner.Name FROM IB_Credit_Adjustment__c WHERE Service_Problem__c = :imp.serviceProblemId ORDER BY Name]) {
    cr.add(new Map<String, Object>{ 'name' => c.Name, 'customer' => c.Account__r.IB_Customer_Id__c, 'amount' => c.Amount__c, 'status' => c.Status__c, 'rule' => c.Decision_Rule__c, 'owner' => c.Owner.Name });
}
out('T1.8 Goodwill credits in the org', cr);
