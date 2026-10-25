/** Telcoforce action for ops: the Agent Fabric kill switch. Isolates (or restores) a partner's agent; audited. */
public with sharing class IB_SetPartnerKillSwitch {
    public class Request {
        @InvocableVariable(label='Partner id' required=true) public String partnerId;
        @InvocableVariable(label='Kill switch on' required=true) public Boolean isOn;
        @InvocableVariable(label='Reason') public String reason;
    }
    public class Result {
        @InvocableVariable(label='Kill switch on') public Boolean isOn;
        @InvocableVariable(label='Decision rule') public String rule;
    }
    @InvocableMethod(label='IB Set Partner Kill Switch' description='Turns the Agent Fabric kill switch on or off for a partner agent.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            IB_Partner__c p = [SELECT Id, Kill_Switch__c FROM IB_Partner__c WHERE Partner_Id__c = :rq.partnerId LIMIT 1];
            p.Kill_Switch__c = rq.isOn == true; update p;
            Result r = new Result(); r.isOn = p.Kill_Switch__c; r.rule = r.isOn ? 'KILL_SWITCH' : 'KILL_SWITCH_LIFTED';
            IB_AuditService.log('human:' + UserInfo.getName(), 'agentFabric.killSwitch', 'none', r.isOn ? 'deny' : 'allow', r.rule, p.Id,
                new Map<String, Object>{ 'partner' => rq.partnerId, 'reason' => rq.reason });
            out.add(r);
        }
        return out;
    }
}
