/**
 * Telcoforce helpers shared by the Telcoforce agent actions: affected-customer lookup,
 * partner agreement checks, the approved fallout repair playbooks and the superagent router.
 * IntentBridge stays the governed layer: every decision here is audited by the calling action.
 */
public with sharing class IB_TelcoforceService {
    public static final Set<String> ALLOW = new Set<String>{ 'READ', 'SCOPED_WRITE', 'PARTNER_AGREEMENT', 'APPROVED_PLAYBOOK', 'RECORDED_PLAYBOOK', 'ROUTED', 'WITHIN_CAP' };

    // ---------- TMF639/638/637 correlation (simulated): customers served from a postcode district ----------
    public static List<Account> customersInDistrict(String district) {
        String d = district == null ? '' : district.trim().toUpperCase();
        String pattern = d + ' %';
        return [SELECT Id, Name, IB_Customer_Id__c, IB_Postcode__c, IB_Vulnerable__c, IB_SIM_Swap_Date__c, IB_Billing_Account__c
                FROM Account WHERE IB_Postcode__c LIKE :pattern ORDER BY IB_Customer_Id__c];
    }

    // ---------- TMF668 partnership agreement ----------
    public class PartnerDecision { public String decision; public String rule; public String reason; public IB_Partner__c partner; }
    public static PartnerDecision checkPartner(String partnerId) {
        PartnerDecision d = new PartnerDecision();
        List<IB_Partner__c> p = [SELECT Id, Name, Partner_Id__c, Status__c, Daily_Qualification_Limit__c, Qualified_Today__c, Max_Order_Lines__c,
                                 Unit_Price__c, Products__c, Kill_Switch__c FROM IB_Partner__c WHERE Partner_Id__c = :partnerId LIMIT 1];
        if (p.isEmpty()) { d.decision = 'deny'; d.rule = 'UNKNOWN_PARTNER'; d.reason = 'No partnership agreement for ' + partnerId; return d; }
        d.partner = p[0];
        if (p[0].Kill_Switch__c == true) { d.decision = 'deny'; d.rule = 'KILL_SWITCH'; d.reason = 'Agent Fabric kill switch is on for ' + p[0].Name; return d; }
        if (p[0].Status__c != 'Active') { d.decision = 'deny'; d.rule = 'PARTNER_NOT_ENTITLED'; d.reason = p[0].Name + ' agreement is ' + p[0].Status__c; return d; }
        d.decision = 'allow'; d.rule = 'PARTNER_AGREEMENT'; d.reason = 'Within the ' + p[0].Name + ' agreement';
        return d;
    }

    // ---------- Approved fallout repair playbooks ----------
    public class RepairPath { public String pathId; public String label; public Boolean human; public String agent; public RepairPath(String i, String n, Boolean h, String a) { pathId = i; label = n; human = h; agent = a; } }
    public static final Map<String, RepairPath> REPAIR_PATHS = new Map<String, RepairPath>{
        'ADDRESS_KEY_MISMATCH' => new RepairPath('RP-ADDR-01', 'Re-key the address from TMF673 and resubmit', false, 'Back-office agent'),
        'PORT_RESERVATION_EXPIRED' => new RepairPath('RP-PORT-02', 'Re-reserve the port (TMF685) and resubmit', false, 'Back-office agent'),
        'LEGACY_OSS_NO_API' => new RepairPath('RP-LEG-04', 'Replay recorded playbook LEG-NP-PORTIN-v3 on the legacy OSS screen', false, 'Systems Integration Agent'),
        'PRICE_MISMATCH' => new RepairPath('RP-PRICE-03', 'Correct the price to catalogue: a person approves any price change', true, 'Ops lead')
    };

    // ---------- Superagent router ----------
    public static final Map<String, List<String>> INTENTS = new Map<String, List<String>>{
        'proactive' => new List<String>{ 'broadband down', 'internet down', 'no internet', 'outage', 'not working', 'down since', 'no service', 'connection', 'wifi', 'fibre' },
        'wholesale' => new List<String>{ 'partner', 'wholesale', 'qualify', 'addresses', 'bulk', 'brightwave', 'quicknet', 'fibrely', 'isp' },
        'fallout' => new List<String>{ 'failed order', 'fallout', 'stuck order', 'orders failed', 'order failed', 'overnight', 'resubmit', 'back office' },
        'consumer' => new List<String>{ 'bill', 'charged', 'higher', 'refund', 'credit', 'price went up', 'cancel', 'leave' },
        'b2b' => new List<String>{ 'quote', 'sd-wan', 'sites', 'sla', 'latency', '5g slice', 'tender' }
    };
    public static final List<String> INJECTION = new List<String>{ 'ignore previous', 'ignore all previous', 'disregard the policy', 'you are now', 'system prompt', 'developer mode', 'override the trust' };
    public static final List<String> VULNERABLE = new List<String>{ 'bereave', 'passed away', 'died', 'carer', 'disabled', 'hospital', 'struggling to pay', 'can\'t afford', 'cannot afford', 'elderly' };

    public class Route { public String journey; public Decimal confidence; public Boolean humanFirst; public Boolean blocked; public String rule; public String secondIntent; public Integer score; }
    public static Route route(String text) {
        Route r = new Route();
        String low = text == null ? '' : text.toLowerCase();
        r.blocked = false; r.humanFirst = false; r.score = 0;
        for (String p : INJECTION) { if (low.contains(p)) { r.blocked = true; r.rule = 'PROMPT_INJECTION'; r.confidence = 0; return r; } }
        for (String v : VULNERABLE) { if (low.contains(v)) { r.humanFirst = true; } }
        String best; Integer bestScore = 0; String second; Integer secondScore = 0;
        for (String j : new List<String>{ 'consumer', 'b2b', 'proactive', 'wholesale', 'fallout' }) {
            Integer sc = 0;
            for (String k : INTENTS.get(j)) { if (low.contains(k)) { sc += k.contains(' ') ? 2 : 1; } }
            if (sc > bestScore) { second = best; secondScore = bestScore; best = j; bestScore = sc; }
            else if (sc > secondScore) { second = j; secondScore = sc; }
        }
        Boolean low1 = bestScore == 0 || (bestScore < 2 && secondScore == bestScore);
        if (low1) { r.rule = 'LOW_CONFIDENCE'; r.confidence = bestScore == 0 ? 0.1 : 0.45; r.humanFirst = true; return r; }
        r.journey = best; r.score = bestScore;
        r.confidence = Math.min(0.97, 0.4 + 0.14 * bestScore).setScale(2);
        if (secondScore >= 2) { r.secondIntent = second; }
        r.rule = r.humanFirst ? 'HUMAN_FIRST' : 'ROUTED';
        return r;
    }

    public static Id queueId() { return IB_RequestCreditAdjustment.supervisorQueueId(); }
}
