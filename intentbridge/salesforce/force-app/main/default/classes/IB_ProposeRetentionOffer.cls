/**
 * Agent action: choose a next-best retention offer (TMF680) that sits within the agent's
 * discount authority, and say whether a human must present it.
 */
public with sharing class IB_ProposeRetentionOffer {
    public class Request {
        @InvocableVariable(label='Account Id' required=true) public Id accountId;
    }
    public class Result {
        @InvocableVariable(label='Offer code') public String offerCode;
        @InvocableVariable(label='Offer name') public String offerName;
        @InvocableVariable(label='Churn risk') public Decimal churnRisk;
        @InvocableVariable(label='Within discount authority') public Boolean withinAuthority;
        @InvocableVariable(label='Requires human') public Boolean requiresHuman;
        @InvocableVariable(label='Guidance') public String guidance;
    }

    @InvocableMethod(label='IB Propose Retention Offer' description='Returns the next-best retention offer for a customer, within the agent discount authority. The customer must consent before any order is placed.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        Set<Id> ids = new Set<Id>();
        for (Request rq : requests) { ids.add(rq.accountId); }
        Map<Id, Account> accts = new Map<Id, Account>([
            SELECT Id, IB_Churn_Risk__c, IB_Vulnerable__c FROM Account WHERE Id IN :ids
        ]);
        IB_TrustPolicy pol = IB_TrustPolicy.get();
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Account a = accts.get(rq.accountId);
            Result r = new Result();
            if (a == null) { r.guidance = 'Account not found.'; out.add(r); continue; }
            Map<String, Object> rec = IB_TmfMockService.getRecommendation(a);
            Map<String, Object> item = (Map<String, Object>) ((List<Object>) rec.get('item'))[0];
            Map<String, Object> po = (Map<String, Object>) item.get('productOffering');
            r.offerCode = (String) po.get('id');
            r.offerName = (String) po.get('name');
            r.churnRisk = (Decimal) rec.get('churnRisk');
            r.withinAuthority = (Decimal) item.get('discountPct') <= pol.discountAuthorityPct;
            r.requiresHuman = a.IB_Vulnerable__c == true || !r.withinAuthority;
            r.guidance = r.requiresHuman
                ? 'Do not present this offer automatically. Hand off to a human adviser.'
                : 'Present the offer, explain it plainly and ask for explicit consent before placing the order.';
            IB_AuditService.log('agent:retention', 'recommendation.get', 'TMF680', 'allow', 'READ_IN_SCOPE', a.Id,
                new Map<String, Object>{ 'offer' => r.offerCode, 'requiresHuman' => r.requiresHuman });
            out.add(r);
        }
        return out;
    }
}
