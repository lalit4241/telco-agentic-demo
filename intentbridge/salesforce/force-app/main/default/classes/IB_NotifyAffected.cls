/**
 * Telcoforce agent action: tell affected customers before they call (TMF681). Trust pack:
 * one message per customer, event and template (DUPLICATE_CONTACT), and a vulnerable customer
 * gets a call from a person instead of a text (VULNERABLE_CUSTOMER, held in the IB Supervisor queue).
 */
public with sharing class IB_NotifyAffected {
    public class Request {
        @InvocableVariable(label='Service problem Id' required=true) public Id serviceProblemId;
        @InvocableVariable(label='Template (outage-notice or restore-notice)' required=true) public String template;
    }
    public class Result {
        @InvocableVariable(label='Messages sent') public Integer sent;
        @InvocableVariable(label='Human calls queued') public Integer humanCalls;
        @InvocableVariable(label='Duplicates refused') public Integer duplicates;
        @InvocableVariable(label='Summary') public String summary;
    }
    @InvocableMethod(label='IB Notify Affected Customers' description='Sends a proactive outage or restore message to every affected customer; vulnerable customers are called by a person; repeat contacts are refused.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        Id q = IB_TelcoforceService.queueId();
        for (Request rq : requests) {
            Result r = new Result(); r.sent = 0; r.humanCalls = 0; r.duplicates = 0;
            IB_Service_Problem__c sp = [SELECT Id, Problem_Id__c, Postcode_District__c, Status__c FROM IB_Service_Problem__c WHERE Id = :rq.serviceProblemId];
            Set<Id> already = new Set<Id>();
            for (IB_Customer_Notification__c n : [SELECT Account__c FROM IB_Customer_Notification__c WHERE Service_Problem__c = :sp.Id AND Template__c = :rq.template]) { already.add(n.Account__c); }
            List<IB_Customer_Notification__c> toInsert = new List<IB_Customer_Notification__c>();
            List<String> dupIds = new List<String>();
            for (Account a : IB_TelcoforceService.customersInDistrict(sp.Postcode_District__c)) {
                if (already.contains(a.Id)) { r.duplicates++; dupIds.add(a.IB_Customer_Id__c); continue; }
                String msg = rq.template == 'restore-notice'
                    ? 'Good news: your broadband is back. Sorry for the disruption. Any goodwill credit will show on your next bill.'
                    : 'We know about a fault affecting broadband in your area and engineers are on it. No need to call: we will update you.';
                IB_Customer_Notification__c n = new IB_Customer_Notification__c(Account__c = a.Id, Service_Problem__c = sp.Id, Template__c = rq.template, Message__c = msg);
                if (a.IB_Vulnerable__c == true) {
                    n.Channel__c = 'human-call'; n.Status__c = 'Pending Human Call'; n.Decision_Rule__c = 'VULNERABLE_CUSTOMER';
                    if (q != null) { n.OwnerId = q; }
                    r.humanCalls++;
                } else { n.Channel__c = 'sms'; n.Status__c = 'Sent'; n.Decision_Rule__c = 'SCOPED_WRITE'; r.sent++; }
                toInsert.add(n);
            }
            insert toInsert;
            IB_AuditService.log('agent:Assurance agent', 'communication.send', 'TMF681', r.humanCalls > 0 ? 'escalate' : 'allow', r.humanCalls > 0 ? 'VULNERABLE_CUSTOMER' : 'SCOPED_WRITE', sp.Id,
                new Map<String, Object>{ 'template' => rq.template, 'sent' => r.sent, 'humanCalls' => r.humanCalls });
            if (r.duplicates > 0) {
                IB_AuditService.log('agent:Assurance agent', 'communication.send', 'TMF681', 'deny', 'DUPLICATE_CONTACT', sp.Id,
                    new Map<String, Object>{ 'template' => rq.template, 'refused' => dupIds });
            }
            r.summary = r.sent + ' sent, ' + r.humanCalls + ' human call(s) queued, ' + r.duplicates + ' duplicate(s) refused';
            out.add(r);
        }
        return out;
    }
}
