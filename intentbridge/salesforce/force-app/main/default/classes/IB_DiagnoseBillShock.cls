/**
 * Agent action: explain why a bill went up (TMF678/TMF677) and link it to any network fault
 * in the customer's postcode (TMF656), returning the credit the trust pack would allow.
 */
public with sharing class IB_DiagnoseBillShock {
    public class Request {
        @InvocableVariable(label='Account Id' required=true) public Id accountId;
    }
    public class Result {
        @InvocableVariable(label='Current bill') public Decimal currentBill;
        @InvocableVariable(label='Increase') public Decimal increase;
        @InvocableVariable(label='Explanation') public String explanation;
        @InvocableVariable(label='Service problem Id') public Id serviceProblemId;
        @InvocableVariable(label='Root cause') public String rootCause;
        @InvocableVariable(label='Suggested credit') public Decimal suggestedCredit;
        @InvocableVariable(label='Within auto-credit cap') public Boolean withinCap;
        @InvocableVariable(label='Needs human (vulnerable or SIM-swap risk)') public Boolean needsHuman;
    }

    @InvocableMethod(label='IB Diagnose Bill Shock' description='Explains a bill increase line by line, links it to any network fault in the customer postcode and suggests a goodwill credit.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        Set<Id> ids = new Set<Id>();
        for (Request rq : requests) { ids.add(rq.accountId); }
        Map<Id, Account> accts = new Map<Id, Account>([
            SELECT Id, Name, IB_Billing_Account__c, IB_Postcode__c, IB_Current_Bill__c, IB_Previous_Bill__c, IB_Vulnerable__c, IB_SIM_Swap_Date__c
            FROM Account WHERE Id IN :ids
        ]);
        IB_TrustPolicy pol = IB_TrustPolicy.get();
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Account a = accts.get(rq.accountId);
            Result r = new Result();
            if (a == null) { r.explanation = 'Account not found.'; out.add(r); continue; }
            Map<String, Object> bill = IB_TmfMockService.getCustomerBill(a);
            Decimal cur = (Decimal) ((Map<String, Object>) bill.get('amountDue')).get('value');
            Decimal prev = (Decimal) ((Map<String, Object>) bill.get('previousAmountDue')).get('value');
            r.currentBill = cur;
            r.increase = (cur - prev).setScale(2);
            IB_Service_Problem__c sp = IB_TmfMockService.findServiceProblem(a.IB_Postcode__c);
            if (sp != null && r.increase > 0) {
                r.serviceProblemId = sp.Id;
                r.rootCause = sp.Root_Cause__c;
                r.suggestedCredit = r.increase;
                r.explanation = 'The bill rose by £' + r.increase + ' because roaming and out-of-bundle mobile data replaced home broadband during network fault '
                    + sp.Problem_Id__c + ' (' + sp.Root_Cause__c + '). The customer is eligible for a credit of £' + r.increase + '.';
            } else if (r.increase > 0) {
                r.suggestedCredit = 0;
                r.explanation = 'The bill rose by £' + r.increase + ' from usage outside the plan. No network fault was found in the area, so no automatic credit applies.';
            } else {
                r.suggestedCredit = 0;
                r.explanation = 'The bill has not increased compared with last month.';
            }
            r.withinCap = r.suggestedCredit <= pol.autoCreditCap;
            r.needsHuman = a.IB_Vulnerable__c == true || IB_TrustPolicy.simSwapRisk(a.IB_SIM_Swap_Date__c, true, true) >= pol.simSwapThreshold;
            IB_AuditService.log('agent:billing', 'bill.diagnose', 'TMF678', 'allow', 'READ_IN_SCOPE', a.Id,
                new Map<String, Object>{ 'increase' => r.increase, 'serviceProblem' => sp == null ? null : sp.Problem_Id__c });
            out.add(r);
        }
        return out;
    }
}
