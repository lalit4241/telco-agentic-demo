/**
 * Telcoforce agent action: a partner agent places a wholesale order (TMF622) over A2A.
 * Orders above the agreement's line limit go to the partner desk (CONTRACT_LIMIT).
 */
public with sharing class IB_PartnerOrder {
    public class Request {
        @InvocableVariable(label='Partner id' required=true) public String partnerId;
        @InvocableVariable(label='Lines' required=true) public Integer lines;
        @InvocableVariable(label='Product') public String product;
    }
    public class Result {
        @InvocableVariable(label='Wholesale order Id') public Id orderId;
        @InvocableVariable(label='Status') public String status;
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Monthly value') public Decimal monthly;
        @InvocableVariable(label='Reply to the partner agent') public String message;
    }
    @InvocableMethod(label='IB Partner Place Wholesale Order' description='Places a wholesale order for a partner agent inside its agreement; larger orders wait for the partner desk.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        Id q = IB_TelcoforceService.queueId();
        for (Request rq : requests) {
            Result r = new Result();
            IB_TelcoforceService.PartnerDecision d = IB_TelcoforceService.checkPartner(rq.partnerId);
            if (d.decision != 'allow') {
                r.status = 'Rejected'; r.rule = d.rule; r.message = d.reason;
                IB_AuditService.log('agent:Partner agent ' + rq.partnerId, 'wholesaleOrder.create', 'TMF622', 'deny', d.rule, d.partner == null ? null : d.partner.Id, new Map<String, Object>{ 'lines' => rq.lines });
                out.add(r); continue;
            }
            IB_Partner__c p = d.partner;
            IB_Wholesale_Order__c o = new IB_Wholesale_Order__c(Partner__c = p.Id, Lines__c = rq.lines, Product__c = String.isBlank(rq.product) ? 'FTTP 900 wholesale' : rq.product,
                Monthly_Value__c = (rq.lines * p.Unit_Price__c).setScale(2));
            String decision;
            if (rq.lines > p.Max_Order_Lines__c) {
                o.Status__c = 'Pending Partner Desk'; o.Decision_Rule__c = 'CONTRACT_LIMIT'; decision = 'escalate';
                if (q != null) { o.OwnerId = q; }
                r.message = rq.lines + ' lines is above the ' + p.Max_Order_Lines__c.intValue() + '-line agreement limit: the partner desk will confirm.';
            } else {
                o.Status__c = 'Acknowledged'; o.Decision_Rule__c = 'PARTNER_AGREEMENT'; decision = 'allow';
                r.message = 'Order acknowledged: ' + rq.lines + ' lines, £' + o.Monthly_Value__c + '/month.';
            }
            insert o;
            IB_AuditService.log('agent:Partner agent ' + rq.partnerId, 'wholesaleOrder.create', 'TMF622', decision, o.Decision_Rule__c, o.Id,
                new Map<String, Object>{ 'lines' => rq.lines, 'monthly' => o.Monthly_Value__c });
            r.orderId = o.Id; r.status = o.Status__c; r.rule = o.Decision_Rule__c; r.monthly = o.Monthly_Value__c;
            out.add(r);
        }
        return out;
    }
}
