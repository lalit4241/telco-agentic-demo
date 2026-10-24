/**
 * Agent action: request a bill credit. At or under the trust-policy cap (default £50) it is
 * applied straight away; above the cap, or for a vulnerable customer, it is held as
 * 'Pending Approval' and assigned to the IB Supervisor queue. Every decision is audited.
 */
public with sharing class IB_RequestCreditAdjustment {
    public class Request {
        @InvocableVariable(label='Account Id' required=true) public Id accountId;
        @InvocableVariable(label='Amount (GBP)' required=true) public Decimal amount;
        @InvocableVariable(label='Reason' required=true) public String reason;
        @InvocableVariable(label='Service problem Id') public Id serviceProblemId;
        @InvocableVariable(label='Requesting agent') public String agentName;
    }
    public class Result {
        @InvocableVariable(label='Credit request Id') public Id creditId;
        @InvocableVariable(label='Status') public String status;
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Message for the customer') public String message;
    }

    @InvocableMethod(label='IB Request Credit Adjustment' description='Requests a bill credit. Credits at or under the trust-policy cap (default £50) are applied; larger credits, any for vulnerable customers, or any after a recent SIM swap (fraud risk) go to a supervisor for approval.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        IB_TrustPolicy pol = IB_TrustPolicy.get();
        Set<Id> ids = new Set<Id>();
        for (Request rq : requests) { ids.add(rq.accountId); }
        Map<Id, Account> accts = new Map<Id, Account>([SELECT Id, IB_Billing_Account__c, IB_Vulnerable__c, IB_SIM_Swap_Date__c FROM Account WHERE Id IN :ids]);
        Id queueId = supervisorQueueId();
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Result r = new Result();
            Account a = accts.get(rq.accountId);
            if (a == null || rq.amount == null || rq.amount <= 0) {
                r.status = 'Rejected';
                r.rule = 'INVALID_REQUEST';
                r.message = 'The credit request was not valid.';
                out.add(r);
                continue;
            }
            IB_Credit_Adjustment__c c = new IB_Credit_Adjustment__c(
                Account__c = a.Id, Amount__c = rq.amount, Reason__c = rq.reason == null ? null : rq.reason.left(255),
                Service_Problem__c = rq.serviceProblemId, Requested_By_Agent__c = String.isBlank(rq.agentName) ? 'Billing agent' : rq.agentName
            );
            String decision;
            if (a.IB_Vulnerable__c == true) {
                c.Status__c = 'Pending Approval'; c.Decision_Rule__c = 'VULNERABLE_CUSTOMER'; decision = 'escalate';
                r.message = 'I have passed your credit to a colleague who will confirm it with you personally.';
            } else if (IB_TrustPolicy.simSwapRisk(a.IB_SIM_Swap_Date__c, true, true) >= pol.simSwapThreshold) {
                c.Status__c = 'Pending Approval'; c.Decision_Rule__c = 'SIM_SWAP_RISK'; decision = 'escalate';
                r.message = 'For your security, a colleague needs to verify your identity before any change to your account. We will contact you on your registered details.';
            } else if (rq.amount > pol.autoCreditCap) {
                c.Status__c = 'Pending Approval'; c.Decision_Rule__c = 'CREDIT_CAP'; decision = 'escalate';
                r.message = 'A credit of £' + rq.amount.setScale(2) + ' needs a supervisor\'s approval. You will hear back today.';
            } else {
                c.Status__c = 'Applied'; c.Decision_Rule__c = 'WITHIN_CAP'; decision = 'allow';
                c.Tmf678_Adjustment_Id__c = IB_TmfMockService.createBillAdjustment(a.IB_Billing_Account__c, rq.amount);
                r.message = 'A credit of £' + rq.amount.setScale(2) + ' has been applied to your next bill.';
            }
            if (c.Status__c == 'Pending Approval' && queueId != null) { c.OwnerId = queueId; }
            insert c;
            IB_AuditService.log('agent:' + c.Requested_By_Agent__c, 'billAdjustment.create', 'TMF678', decision, c.Decision_Rule__c, c.Id,
                new Map<String, Object>{ 'amount' => rq.amount, 'cap' => pol.autoCreditCap, 'reason' => c.Reason__c });
            r.creditId = c.Id;
            r.status = c.Status__c;
            r.rule = c.Decision_Rule__c;
            out.add(r);
        }
        return out;
    }

    public static Id supervisorQueueId() {
        List<Group> g = [SELECT Id FROM Group WHERE Type = 'Queue' AND DeveloperName = 'IB_Supervisor' LIMIT 1];
        return g.isEmpty() ? null : g[0].Id;
    }
}
