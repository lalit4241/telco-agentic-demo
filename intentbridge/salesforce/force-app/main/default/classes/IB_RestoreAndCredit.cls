/**
 * Telcoforce agent action: close the loop on an outage. Goodwill credits are only ever requested
 * once the problem is resolved (PROBLEM_NOT_RESOLVED otherwise), once per customer per problem,
 * and every credit goes through the IntentBridge trust pack (cap, vulnerable, SIM-swap).
 */
public with sharing class IB_RestoreAndCredit {
    public class Request {
        @InvocableVariable(label='Service problem Id' required=true) public Id serviceProblemId;
        @InvocableVariable(label='Goodwill amount (GBP)' required=true) public Decimal goodwill;
        @InvocableVariable(label='Mark the problem resolved first') public Boolean markResolved;
    }
    public class Result {
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Credits applied') public Integer applied;
        @InvocableVariable(label='Credits waiting for a person') public Integer escalated;
        @InvocableVariable(label='Already credited (skipped)') public Integer skipped;
        @InvocableVariable(label='Per-customer rules') public String detail;
    }
    @InvocableMethod(label='IB Restore Service and Credit' description='After the service problem is resolved, requests one goodwill credit per affected customer through the trust pack.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Result r = new Result(); r.applied = 0; r.escalated = 0; r.skipped = 0;
            IB_Service_Problem__c sp = [SELECT Id, Problem_Id__c, Postcode_District__c, Status__c FROM IB_Service_Problem__c WHERE Id = :rq.serviceProblemId];
            if (rq.markResolved == true && sp.Status__c != 'resolved') {
                sp.Status__c = 'resolved'; update sp;
                IB_AuditService.log('agent:Assurance agent', 'serviceProblem.patch', 'TMF656', 'allow', 'SCOPED_WRITE', sp.Id, new Map<String, Object>{ 'status' => 'resolved' });
            }
            if (sp.Status__c != 'resolved') {
                r.rule = 'PROBLEM_NOT_RESOLVED';
                IB_AuditService.log('agent:Assurance agent', 'billAdjustment.create', 'TMF678', 'deny', r.rule, sp.Id, new Map<String, Object>{ 'goodwill' => rq.goodwill, 'status' => sp.Status__c });
                out.add(r); continue;
            }
            Set<Id> credited = new Set<Id>();
            for (IB_Credit_Adjustment__c c : [SELECT Account__c FROM IB_Credit_Adjustment__c WHERE Service_Problem__c = :sp.Id]) { credited.add(c.Account__c); }
            List<IB_RequestCreditAdjustment.Request> reqs = new List<IB_RequestCreditAdjustment.Request>();
            List<String> who = new List<String>();
            for (Account a : IB_TelcoforceService.customersInDistrict(sp.Postcode_District__c)) {
                if (credited.contains(a.Id)) { r.skipped++; continue; }
                IB_RequestCreditAdjustment.Request cr = new IB_RequestCreditAdjustment.Request();
                cr.accountId = a.Id; cr.amount = rq.goodwill; cr.serviceProblemId = sp.Id; cr.agentName = 'Assurance agent';
                cr.reason = 'Proactive goodwill: ' + sp.Problem_Id__c + ' outage';
                reqs.add(cr); who.add(a.IB_Customer_Id__c);
            }
            List<String> detail = new List<String>();
            if (!reqs.isEmpty()) {
                List<IB_RequestCreditAdjustment.Result> res = IB_RequestCreditAdjustment.run(reqs);
                for (Integer i = 0; i < res.size(); i++) {
                    if (res[i].status == 'Applied') { r.applied++; } else { r.escalated++; }
                    detail.add(who[i] + ':' + res[i].rule);
                }
            }
            r.rule = 'GOODWILL_AFTER_RESTORE'; r.detail = String.join(detail, ', ');
            out.add(r);
        }
        return out;
    }
}
