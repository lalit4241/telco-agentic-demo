/**
 * Telcoforce agent action (wholesale agent, A2A front door): a partner's own agent asks to
 * qualify addresses in bulk (TMF645). The partnership agreement (TMF668) meters it: unknown or
 * suspended partners are refused, the daily limit is enforced, and the kill switch isolates the partner.
 */
public with sharing class IB_PartnerQualify {
    public class Request {
        @InvocableVariable(label='Partner id' required=true) public String partnerId;
        @InvocableVariable(label='Address count' required=true) public Integer addressCount;
    }
    public class Result {
        @InvocableVariable(label='Decision') public String decision;
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Qualified') public Integer qualified;
        @InvocableVariable(label='Not qualified') public Integer notQualified;
        @InvocableVariable(label='Remaining today') public Integer remaining;
        @InvocableVariable(label='Reply to the partner agent') public String message;
    }
    @InvocableMethod(label='IB Partner Qualify Addresses' description='Bulk address qualification for a wholesale partner agent, metered by its agreement.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Result r = new Result(); r.qualified = 0; r.notQualified = 0;
            IB_TelcoforceService.PartnerDecision d = IB_TelcoforceService.checkPartner(rq.partnerId);
            IB_Partner__c p = d.partner;
            Integer n = rq.addressCount == null ? 0 : rq.addressCount;
            if (p != null) {
                Integer used = p.Qualified_Today__c == null ? 0 : p.Qualified_Today__c.intValue();
                r.remaining = Math.max(0, p.Daily_Qualification_Limit__c.intValue() - used);
                if (d.decision == 'allow' && n > r.remaining) { d.decision = 'deny'; d.rule = 'PARTNER_RATE_LIMIT'; d.reason = 'Asked for ' + n + ', ' + r.remaining + ' left today'; }
            }
            if (d.decision == 'allow') {
                for (Integer i = 0; i < n; i++) { if (Math.mod(i * 7, 25) != 3) { r.qualified++; } else { r.notQualified++; } }
                p.Qualified_Today__c = (p.Qualified_Today__c == null ? 0 : p.Qualified_Today__c) + n; update p;
                r.remaining -= n;
                d.reason = r.qualified + ' of ' + n + ' addresses can take FTTP';
            }
            r.decision = d.decision; r.rule = d.rule; r.message = d.reason;
            IB_AuditService.log('agent:Partner agent ' + rq.partnerId, 'wholesaleQualification.check', 'TMF645', d.decision, d.rule, p == null ? null : p.Id,
                new Map<String, Object>{ 'partner' => rq.partnerId, 'addresses' => n, 'qualified' => r.qualified });
            out.add(r);
        }
        return out;
    }
}
