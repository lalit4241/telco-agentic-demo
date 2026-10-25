/**
 * Telcoforce agent action (back-office agent + Systems Integration Agent): repair a failed product
 * order (TMF622) only with an approved playbook. Price changes and unknown errors go to the ops lead.
 * Same input, same result, every time.
 */
public with sharing class IB_RepairFalloutOrder {
    public class Request {
        @InvocableVariable(label='Product order id' required=true) public String orderId;
    }
    public class Result {
        @InvocableVariable(label='State') public String state;
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Repair path') public String repairPath;
        @InvocableVariable(label='Repaired by') public String repairedBy;
        @InvocableVariable(label='Message') public String message;
    }
    @InvocableMethod(label='IB Repair Fallout Order' description='Repairs a failed order with an approved playbook, or hands it to the ops lead when no playbook applies or a price would change.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        Id q = IB_TelcoforceService.queueId();
        for (Request rq : requests) {
            Result r = new Result();
            List<IB_Fallout_Order__c> os = [SELECT Id, Order_Id__c, Error_Code__c, State__c, Amount__c, Catalogue_Price__c, Repair_Path__c, Decision_Rule__c, Repair_Log__c FROM IB_Fallout_Order__c WHERE Order_Id__c = :rq.orderId LIMIT 1];
            if (os.isEmpty()) { r.rule = 'NOT_FOUND'; r.message = 'No order ' + rq.orderId; out.add(r); continue; }
            IB_Fallout_Order__c o = os[0];
            if (o.State__c != 'failed') { r.state = o.State__c; r.rule = 'NOT_FAILED'; r.message = o.Order_Id__c + ' is not in fallout'; out.add(r); continue; }
            IB_TelcoforceService.RepairPath rp = IB_TelcoforceService.REPAIR_PATHS.get(o.Error_Code__c);
            String decision; String log = o.Repair_Log__c == null ? '' : o.Repair_Log__c + '\n';
            if (rp == null) {
                o.State__c = 'held'; o.Decision_Rule__c = 'NO_APPROVED_PLAYBOOK'; decision = 'escalate'; r.repairedBy = 'Ops lead';
                r.message = 'No approved playbook for ' + o.Error_Code__c + ': passed to the ops lead, not improvised.';
            } else if (rp.human) {
                o.State__c = 'held'; o.Repair_Path__c = rp.pathId; o.Decision_Rule__c = 'PRICE_CHANGE_NEEDS_HUMAN'; decision = 'escalate'; r.repairedBy = rp.agent;
                r.message = 'Order price £' + o.Amount__c + ' vs catalogue £' + o.Catalogue_Price__c + ': a person approves any price change.';
            } else {
                o.State__c = 'inProgress'; o.Repair_Path__c = rp.pathId; o.Decision_Rule__c = rp.pathId == 'RP-LEG-04' ? 'RECORDED_PLAYBOOK' : 'APPROVED_PLAYBOOK'; decision = 'allow'; r.repairedBy = rp.agent;
                r.message = rp.label + ': resubmitted.';
            }
            if ((rp == null || rp.human) && q != null) { o.OwnerId = q; }
            o.Repair_Log__c = (log + Datetime.now().formatGmt('yyyy-MM-dd HH:mm') + ' ' + o.Decision_Rule__c + ' ' + r.message).left(32000);
            update o;
            IB_AuditService.log('agent:' + r.repairedBy, rp != null && rp.pathId == 'RP-LEG-04' ? 'legacyScreen.run' : 'productOrder.patch', rp != null && rp.pathId == 'RP-LEG-04' ? 'none' : 'TMF622', decision, o.Decision_Rule__c, o.Id,
                new Map<String, Object>{ 'order' => o.Order_Id__c, 'error' => o.Error_Code__c, 'repairPath' => o.Repair_Path__c });
            r.state = o.State__c; r.rule = o.Decision_Rule__c; r.repairPath = o.Repair_Path__c;
            out.add(r);
        }
        return out;
    }
}
