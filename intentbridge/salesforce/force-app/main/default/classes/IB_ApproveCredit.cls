/**
 * Supervisor action (screen flow, Slack or Coworker): approve or reject a held credit.
 */
public with sharing class IB_ApproveCredit {
    public class Request {
        @InvocableVariable(label='Credit request Id' required=true) public Id creditId;
        @InvocableVariable(label='Approve' required=true) public Boolean approve;
        @InvocableVariable(label='Comment') public String comment;
    }
    public class Result {
        @InvocableVariable(label='Status') public String status;
        @InvocableVariable(label='Message') public String message;
    }

    @InvocableMethod(label='IB Approve or Reject Credit' description='Supervisor decision on a credit that is waiting for approval.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        Set<Id> ids = new Set<Id>();
        for (Request rq : requests) { ids.add(rq.creditId); }
        Map<Id, IB_Credit_Adjustment__c> credits = new Map<Id, IB_Credit_Adjustment__c>([
            SELECT Id, Status__c, Amount__c, Account__r.IB_Billing_Account__c FROM IB_Credit_Adjustment__c WHERE Id IN :ids
        ]);
        List<Result> out = new List<Result>();
        List<IB_Credit_Adjustment__c> upd = new List<IB_Credit_Adjustment__c>();
        for (Request rq : requests) {
            Result r = new Result();
            IB_Credit_Adjustment__c c = credits.get(rq.creditId);
            if (c == null || c.Status__c != 'Pending Approval') {
                r.status = c == null ? 'Not found' : c.Status__c;
                r.message = 'Only credits waiting for approval can be decided.';
                out.add(r);
                continue;
            }
            c.Status__c = rq.approve ? 'Approved' : 'Rejected';
            c.Decided_By__c = UserInfo.getUserId();
            c.Decision_Comment__c = rq.comment == null ? null : rq.comment.left(255);
            if (rq.approve) { c.Tmf678_Adjustment_Id__c = IB_TmfMockService.createBillAdjustment(c.Account__r.IB_Billing_Account__c, c.Amount__c); }
            upd.add(c);
            r.status = c.Status__c;
            r.message = 'Credit of £' + c.Amount__c.setScale(2) + ' ' + c.Status__c.toLowerCase() + '.';
            out.add(r);
        }
        update upd;
        for (IB_Credit_Adjustment__c c : upd) {
            IB_AuditService.log('human:' + UserInfo.getName(), 'billAdjustment.decide', 'TMF678', c.Status__c == 'Approved' ? 'approved' : 'rejected', 'SUPERVISOR_DECISION', c.Id,
                new Map<String, Object>{ 'amount' => c.Amount__c, 'comment' => c.Decision_Comment__c });
        }
        return out;
    }
}
