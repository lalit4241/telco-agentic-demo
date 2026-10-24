/**
 * Agent action: check whether an SD-WAN + 5G slice SLA is feasible across a customer's sites
 * by raising a TMF921 probe intent and a TMF645 qualification, before any quote is made.
 */
public with sharing class IB_CheckSlaFeasibility {
    public class Request {
        @InvocableVariable(label='Account Id' required=true) public Id accountId;
        @InvocableVariable(label='Number of sites' description='Used when Site list is blank (sites NW-S01..NW-Snn)') public Integer siteCount;
        @InvocableVariable(label='Site list' description='Comma-separated site ids, e.g. NW-S01,NW-S13') public String siteList;
        @InvocableVariable(label='Availability target %') public Decimal availabilityTarget;
        @InvocableVariable(label='Latency target (ms)') public Decimal latencyMs;
    }
    public class Result {
        @InvocableVariable(label='Intent record Id') public Id intentId;
        @InvocableVariable(label='Sites requested') public Integer sitesRequested;
        @InvocableVariable(label='Sites feasible') public Integer sitesFeasible;
        @InvocableVariable(label='Infeasible sites') public String infeasibleSites;
        @InvocableVariable(label='Summary for the user') public String summary;
    }

    @InvocableMethod(label='IB Check SLA Feasibility' description='Raises a TMF921 probe intent and TMF645 qualification for an SD-WAN + 5G slice SLA and returns which sites can meet it. Call before quoting.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        IB_TrustPolicy pol = IB_TrustPolicy.get();
        for (Request rq : requests) {
            List<String> sites = new List<String>();
            if (String.isNotBlank(rq.siteList)) {
                for (String s : rq.siteList.split(',')) { if (String.isNotBlank(s)) { sites.add(s.trim().toUpperCase()); } }
            } else {
                Integer n = rq.siteCount == null ? 40 : rq.siteCount;
                for (Integer i = 1; i <= n; i++) { sites.add('NW-S' + String.valueOf(i).leftPad(2, '0')); }
            }
            Decimal avail = rq.availabilityTarget == null ? pol.slaTarget : rq.availabilityTarget;
            Decimal lat = rq.latencyMs == null ? 30 : rq.latencyMs;

            Map<String, Object> sq = IB_TmfMockService.checkServiceQualification(sites, avail, lat);
            List<String> bad = new List<String>();
            List<String> reasons = new List<String>();
            for (Object o : (List<Object>) sq.get('serviceQualificationItem')) {
                Map<String, Object> it = (Map<String, Object>) o;
                if ((String) it.get('qualificationResult') != 'qualified') {
                    bad.add((String) it.get('id'));
                    Map<String, Object> rsn = (Map<String, Object>) ((List<Object>) it.get('eligibilityUnavailabilityReason'))[0];
                    reasons.add(String.valueOf(it.get('id')) + ' (' + String.valueOf(rsn.get('label')) + ')');
                }
            }
            Integer ok = sites.size() - bad.size();
            IB_Intent__c intent = new IB_Intent__c(
                Name = 'SD-WAN ' + String.valueOf(avail) + '% / ' + String.valueOf(lat) + 'ms probe',
                Account__c = rq.accountId,
                Lifecycle_Status__c = 'assessed',
                Tmf_Intent_Id__c = 'INT-' + String.valueOf(Datetime.now().getTime()).right(6),
                Availability_Target__c = avail,
                Latency_Ms__c = lat,
                Sites_Requested__c = sites.size(),
                Sites_Feasible__c = ok,
                Infeasible_Sites__c = String.join(reasons, '\n'),
                Expression__c = JSON.serializePretty(IB_TmfMockService.intentExpression(sites.size(), avail, lat)),
                Intent_Report__c = JSON.serializePretty(sq)
            );
            insert intent;
            IB_AuditService.log('agent:quoting', 'intent.create(probe)', 'TMF921', 'allow', 'SCOPED_WRITE', intent.Id,
                new Map<String, Object>{ 'sites' => sites.size(), 'feasible' => ok, 'infeasible' => bad });

            Result r = new Result();
            r.intentId = intent.Id;
            r.sitesRequested = sites.size();
            r.sitesFeasible = ok;
            r.infeasibleSites = String.join(bad, ', ');
            r.summary = String.valueOf(ok) + ' of ' + String.valueOf(sites.size()) + ' sites can meet ' + String.valueOf(avail) + '% availability and ' + String.valueOf(lat) + ' ms latency.'
                + (bad.isEmpty() ? '' : ' Not feasible: ' + String.join(reasons, '; ') + '. Quote the feasible sites and offer an alternative (e.g. Ethernet with 4G backup) for the rest.');
            out.add(r);
        }
        return out;
    }
}
