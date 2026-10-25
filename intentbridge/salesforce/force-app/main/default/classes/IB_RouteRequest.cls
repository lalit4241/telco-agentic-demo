/**
 * Telcoforce superagent front door: route a request to the right specialist journey, refuse
 * prompt injection, and put a person first when the customer may be vulnerable or the router is unsure.
 */
public with sharing class IB_RouteRequest {
    public class Request {
        @InvocableVariable(label='Request text' required=true) public String text;
    }
    public class Result {
        @InvocableVariable(label='Journey') public String journey;
        @InvocableVariable(label='Confidence') public Decimal confidence;
        @InvocableVariable(label='Person first') public Boolean humanFirst;
        @InvocableVariable(label='Blocked') public Boolean blocked;
        @InvocableVariable(label='Decision rule') public String rule;
        @InvocableVariable(label='Second intent') public String secondIntent;
    }
    @InvocableMethod(label='IB Route Request (Superagent)' description='Routes a customer, partner or ops request to the right Telcoforce journey, with guardrails.' category='Telcoforce')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            IB_TelcoforceService.Route rt = IB_TelcoforceService.route(rq.text);
            Result r = new Result();
            r.journey = rt.journey; r.confidence = rt.confidence; r.humanFirst = rt.humanFirst; r.blocked = rt.blocked; r.rule = rt.rule; r.secondIntent = rt.secondIntent;
            IB_AuditService.log('agent:Superagent', 'superagent.route', 'none', rt.blocked ? 'deny' : (rt.humanFirst ? 'escalate' : 'allow'), rt.rule, null,
                new Map<String, Object>{ 'text' => rq.text == null ? '' : rq.text.left(500), 'journey' => rt.journey, 'confidence' => rt.confidence });
            out.add(r);
        }
        return out;
    }
}
