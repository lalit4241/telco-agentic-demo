/**
 * IntentBridge: list credit adjustments waiting for supervisor approval (the HITL queue).
 */
public with sharing class IB_ListPendingCredits {
    public class Request {
        @InvocableVariable(label='Customer name filter' description='Optional: only credits for customers whose name contains this text') public String customerFilter;
    }
    public class Result {
        @InvocableVariable(label='Pending count') public Integer pendingCount;
        @InvocableVariable(label='Pending credits (JSON)') public String pendingJson;
        @InvocableVariable(label='Summary') public String summary;
    }

    @InvocableMethod(label='IB List Pending Credits' description='Lists bill credits waiting for supervisor approval, with the credit request Id, customer, amount, reason and the rule that held it.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            String f = (rq == null || String.isBlank(rq.customerFilter)) ? '%' : '%' + rq.customerFilter.trim() + '%';
            List<IB_Credit_Adjustment__c> rows = [
                SELECT Id, Name, Account__r.Name, Amount__c, Reason__c, Decision_Rule__c, Requested_By_Agent__c, CreatedDate
                FROM IB_Credit_Adjustment__c WHERE Status__c = 'Pending Approval' AND Account__r.Name LIKE :f
                ORDER BY CreatedDate LIMIT 20
            ];
            List<Map<String, Object>> items = new List<Map<String, Object>>();
            List<String> lines = new List<String>();
            for (IB_Credit_Adjustment__c c : rows) {
                items.add(new Map<String, Object>{
                    'creditId' => c.Id, 'reference' => c.Name, 'customer' => c.Account__r.Name, 'amountGBP' => c.Amount__c,
                    'reason' => c.Reason__c, 'heldBy' => c.Decision_Rule__c, 'requestedBy' => c.Requested_By_Agent__c
                });
                lines.add(c.Name + ': ' + c.Account__r.Name + ' £' + String.valueOf(c.Amount__c.setScale(2)) + ' (' + c.Decision_Rule__c + ')');
            }
            Result r = new Result();
            r.pendingCount = rows.size();
            r.pendingJson = JSON.serialize(items);
            r.summary = rows.isEmpty() ? 'No credits are waiting for approval.' : rows.size() + ' waiting: ' + String.join(lines, '; ');
            out.add(r);
        }
        return out;
    }
}