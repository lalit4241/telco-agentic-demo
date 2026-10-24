/**
 * Mock TM Forum Open API facade. Returns TMF-shaped maps built from org data plus
 * deterministic mock network data. Swap these methods for Named Credential callouts
 * (MuleSoft / Agent Fabric) to go live; the action contracts stay the same.
 */
public with sharing class IB_TmfMockService {

    /** Sites that fail SD-WAN + 5G slice qualification in the mock RAN/transport inventory. */
    public static final Map<String, String> INFEASIBLE = new Map<String, String>{
        'NW-S13' => 'Carlisle: 5G slice capacity at 96% in the serving cell',
        'NW-S31' => 'Truro: FTTC access only, no 5G coverage',
        'NW-S37' => 'Inverness: FTTC access only, no 5G coverage'
    };

    // ---------- TMF645 Service Qualification ----------
    public static Map<String, Object> checkServiceQualification(List<String> sites, Decimal availability, Decimal latencyMs) {
        List<Object> items = new List<Object>();
        for (String s : sites) {
            Boolean ok = !INFEASIBLE.containsKey(s);
            if (latencyMs != null && latencyMs < 10) { ok = false; }
            Map<String, Object> item = new Map<String, Object>{
                'id' => s,
                'qualificationResult' => ok ? 'qualified' : 'unqualified',
                'service' => new Map<String, Object>{ 'serviceSpecification' => new Map<String, Object>{ 'id' => 'CFS-SDWAN', 'name' => 'Managed SD-WAN with 5G slice' } }
            };
            if (!ok) {
                item.put('eligibilityUnavailabilityReason', new List<Object>{
                    new Map<String, Object>{ 'code' => 'CAPACITY', 'label' => INFEASIBLE.containsKey(s) ? INFEASIBLE.get(s) : 'Latency target below network capability' }
                });
            }
            items.add(item);
        }
        return new Map<String, Object>{
            '@type' => 'CheckServiceQualification',
            'state' => 'done',
            'qualificationResult' => 'partial',
            'serviceQualificationItem' => items
        };
    }

    // ---------- TMF921 Intent ----------
    public static Map<String, Object> intentExpression(Integer siteCount, Decimal availability, Decimal latencyMs) {
        return new Map<String, Object>{
            '@type' => 'JsonLdExpression',
            'expressionValue' => new Map<String, Object>{
                '@context' => new Map<String, Object>{ 'icm' => 'http://tio.models.tmforum.org/tio/v3.6.0/IntentCommonModel/' },
                'icm:intentElement' => new Map<String, Object>{
                    'service' => 'SD-WAN with 5G slice',
                    'sites' => siteCount,
                    'availability' => new Map<String, Object>{ 'icm:atLeast' => availability },
                    'latencyMs' => new Map<String, Object>{ 'icm:atMost' => latencyMs }
                }
            }
        };
    }

    // ---------- TMF678 Customer Bill ----------
    public static Map<String, Object> getCustomerBill(Account a) {
        Decimal cur = a.IB_Current_Bill__c == null ? 0 : a.IB_Current_Bill__c;
        Decimal prev = a.IB_Previous_Bill__c == null ? cur : a.IB_Previous_Bill__c;
        return new Map<String, Object>{
            '@type' => 'CustomerBill',
            'billingAccount' => new Map<String, Object>{ 'id' => a.IB_Billing_Account__c },
            'amountDue' => new Map<String, Object>{ 'unit' => 'GBP', 'value' => cur },
            'previousAmountDue' => new Map<String, Object>{ 'unit' => 'GBP', 'value' => prev },
            'state' => 'sent'
        };
    }

    // ---------- TMF656 Service Problem ----------
    public static IB_Service_Problem__c findServiceProblem(String postcode) {
        if (String.isBlank(postcode)) { return null; }
        String district = postcode.trim().toUpperCase().split(' ')[0];
        List<IB_Service_Problem__c> sp = [
            SELECT Id, Name, Problem_Id__c, Root_Cause__c, Impact__c, Resource__c, Status__c, Started__c, Postcode_District__c
            FROM IB_Service_Problem__c
            WHERE Postcode_District__c = :district AND Status__c IN ('acknowledged', 'inProgress', 'resolved')
            ORDER BY Started__c DESC LIMIT 1
        ];
        return sp.isEmpty() ? null : sp[0];
    }

    // ---------- TMF680 Recommendation ----------
    public static Map<String, Object> getRecommendation(Account a) {
        Decimal risk = a.IB_Churn_Risk__c == null ? 0 : a.IB_Churn_Risk__c;
        String code; String name; Decimal discountPct;
        if (risk >= 0.6) { code = 'PO-RET-UNL3'; name = 'Loyalty: unlimited data for 3 months at no extra cost'; discountPct = 0; }
        else if (risk >= 0.3) { code = 'PO-RET-5OFF'; name = '£5 off per month for 12 months'; discountPct = 8; }
        else { code = 'PO-RET-BOOST'; name = 'Free broadband speed boost for 6 months'; discountPct = 0; }
        return new Map<String, Object>{
            '@type' => 'Recommendation',
            'type' => 'retention',
            'churnRisk' => risk,
            'item' => new List<Object>{ new Map<String, Object>{ 'productOffering' => new Map<String, Object>{ 'id' => code, 'name' => name }, 'discountPct' => discountPct } }
        };
    }

    // ---------- TMF678 billing adjustment facade ----------
    public static String createBillAdjustment(String billingAccount, Decimal amount) {
        return 'ADJ-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).leftPad(10, '0').substring(0, 6);
    }
}
