/**
 * Trust-pack thresholds (IB_Trust_Policy__mdt 'Default'), with safe built-in defaults.
 */
public with sharing class IB_TrustPolicy {
    public Decimal autoCreditCap = 50;
    public Decimal discountAuthorityPct = 10;
    public Decimal slaTarget = 99.95;
    public Decimal simSwapThreshold = 70;

    @TestVisible private static IB_TrustPolicy cached;
    @TestVisible private static IB_TrustPolicy testOverride;

    public static IB_TrustPolicy get() {
        if (testOverride != null) { return testOverride; }
        if (cached != null) { return cached; }
        IB_TrustPolicy p = new IB_TrustPolicy();
        List<IB_Trust_Policy__mdt> rows = [
            SELECT Auto_Credit_Cap__c, Discount_Authority_Pct__c, SLA_Target__c, Sim_Swap_Threshold__c
            FROM IB_Trust_Policy__mdt WHERE DeveloperName = 'Default' LIMIT 1
        ];
        if (!rows.isEmpty()) {
            IB_Trust_Policy__mdt r = rows[0];
            if (r.Auto_Credit_Cap__c != null) { p.autoCreditCap = r.Auto_Credit_Cap__c; }
            if (r.Discount_Authority_Pct__c != null) { p.discountAuthorityPct = r.Discount_Authority_Pct__c; }
            if (r.SLA_Target__c != null) { p.slaTarget = r.SLA_Target__c; }
            if (r.Sim_Swap_Threshold__c != null) { p.simSwapThreshold = r.Sim_Swap_Threshold__c; }
        }
        cached = p;
        return p;
    }

    /** SIM-swap risk: swap within 2 days = 60, +15 digital channel, +15 sensitive request. */
    public static Integer simSwapRisk(Date swapDate, Boolean digital, Boolean sensitive) {
        if (swapDate == null) { return 0; }
        Integer days = swapDate.daysBetween(Date.today());
        Integer score = days <= 2 ? 60 : (days <= 7 ? 30 : 0);
        if (score > 0 && digital == true) { score += 15; }
        if (score > 0 && sensitive == true) { score += 15; }
        return score;
    }
}
