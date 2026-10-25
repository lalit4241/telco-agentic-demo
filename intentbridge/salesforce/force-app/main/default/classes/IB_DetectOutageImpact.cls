/**
 * Telcoforce agent action (assurance agent, long-horizon): a network alarm is correlated to the
 * customers it affects (TMF642 -> TMF639 -> TMF638 -> TMF637 -> TMF629, simulated) and one
 * TMF656 service problem is opened or updated for the event. Read-only on the network.
 */
public with sharing class IB_DetectOutageImpact {
    public class Request {
        @InvocableVariable(label='Alarm Id' required=true) public String alarmId;
        @InvocableVariable(label='Affected resource' required=true) public String resource;
        @InvocableVariable(label='Postcode district' required=true) public String district;
        @InvocableVariable(label='Root cause') public String rootCause;
    }
    public class Result {
        @InvocableVariable(label='Service problem Id') public Id serviceProblemId;
        @InvocableVariable(label='TMF656 problem id') public String problemId;
        @InvocableVariable(label='Customers affected') public Integer customersAffected;
        @InvocableVariable(label='Vulnerable customers') public Integer vulnerable;
        @InvocableVariable(label='Customer ids') public String customerIds;
        @InvocableVariable(label='Decision rule') public String rule;
    }
    @InvocableMethod(label='IB Detect Outage Impact' description='Correlates a network alarm to the customers it affects and opens one service problem for the event (read-only on the network).' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Result r = new Result();
            List<Account> affected = IB_TelcoforceService.customersInDistrict(rq.district);
            List<String> ids = new List<String>(); Integer vuln = 0;
            for (Account a : affected) { ids.add(a.IB_Customer_Id__c); if (a.IB_Vulnerable__c == true) { vuln++; } }
            IB_Service_Problem__c sp = new IB_Service_Problem__c(
                Name = (rq.district.toUpperCase() + ' outage: ' + rq.resource).left(80), Problem_Id__c = 'SP-' + rq.alarmId,
                Postcode_District__c = rq.district.toUpperCase(), Status__c = 'inProgress', Resource__c = rq.resource,
                Root_Cause__c = String.isBlank(rq.rootCause) ? 'Under investigation (alarm ' + rq.alarmId + ')' : rq.rootCause.left(255),
                Impact__c = (affected.size() + ' customers served by ' + rq.resource).left(255), Started__c = Datetime.now(),
                Customers_Affected__c = affected.size());
            upsert sp Problem_Id__c;
            IB_AuditService.log('agent:Assurance agent', 'serviceProblem.create', 'TMF656', 'allow', 'SCOPED_WRITE', sp.Id,
                new Map<String, Object>{ 'alarm' => rq.alarmId, 'resource' => rq.resource, 'district' => sp.Postcode_District__c, 'affected' => ids });
            r.serviceProblemId = sp.Id; r.problemId = sp.Problem_Id__c; r.customersAffected = affected.size(); r.vulnerable = vuln;
            r.customerIds = String.join(ids, ','); r.rule = 'SCOPED_WRITE';
            out.add(r);
        }
        return out;
    }
}
