/**
 * Hash-chained agent audit log. Each entry stores SHA-256(prevHash | canonical entry).
 * Personal data is masked before it is written.
 */
public without sharing class IB_AuditService {
    public static final String GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';
    private static final Pattern EMAIL = Pattern.compile('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}');
    private static final Pattern PHONE = Pattern.compile('(\\+44\\s?|0)7\\d{3}\\s?\\d{6}');
    private static final Pattern POSTCODE = Pattern.compile('\\b([A-Z]{1,2}\\d[A-Z\\d]?)\\s?\\d[A-Z]{2}\\b');

    public static String maskPII(String s) {
        if (String.isBlank(s)) { return s; }
        String out = EMAIL.matcher(s).replaceAll('<email:masked>');
        out = PHONE.matcher(out).replaceAll('<phone:masked>');
        out = POSTCODE.matcher(out).replaceAll('$1 ***');
        return out;
    }

    public static String sha256(String s) {
        return EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', Blob.valueOf(s == null ? '' : s)));
    }

    public static String canonical(Decimal seq, String actor, String tool, String tmf, String decision, String rule, String recordId, String payload) {
        return String.join(new List<String>{
            String.valueOf(seq), n(actor), n(tool), n(tmf), n(decision), n(rule), n(recordId), n(payload)
        }, '|');
    }
    private static String n(String s) { return s == null ? '' : s; }

    public static IB_Agent_Audit_Log__c log(String actor, String tool, String tmf, String decision, String rule, Id recordId, Object payload) {
        List<IB_Agent_Audit_Log__c> last = [SELECT Seq__c, Hash__c FROM IB_Agent_Audit_Log__c ORDER BY Seq__c DESC LIMIT 1];
        Decimal seq = last.isEmpty() ? 1 : last[0].Seq__c + 1;
        String prev = last.isEmpty() ? GENESIS : last[0].Hash__c;
        String body = payload == null ? '' : (payload instanceof String ? (String) payload : JSON.serialize(payload));
        body = maskPII(body);
        if (body.length() > 32000) { body = body.substring(0, 32000); }
        String rid = recordId == null ? null : String.valueOf(recordId);
        IB_Agent_Audit_Log__c e = new IB_Agent_Audit_Log__c(
            Seq__c = seq, Actor__c = actor, Tool__c = tool, Tmf_Api__c = tmf, Decision__c = decision,
            Rule__c = rule, Record_Id__c = rid, Payload_Masked__c = body, Prev_Hash__c = prev
        );
        e.Hash__c = sha256(prev + '|' + canonical(seq, actor, tool, tmf, decision, rule, rid, body));
        insert e;
        return e;
    }

    public class VerifyResult {
        @AuraEnabled public Boolean ok;
        @AuraEnabled public Integer entries;
        @AuraEnabled public Decimal brokenAt;
    }

    public static VerifyResult verify() {
        VerifyResult r = new VerifyResult();
        r.ok = true;
        String prev = GENESIS;
        List<IB_Agent_Audit_Log__c> rows = [
            SELECT Seq__c, Actor__c, Tool__c, Tmf_Api__c, Decision__c, Rule__c, Record_Id__c, Payload_Masked__c, Hash__c, Prev_Hash__c
            FROM IB_Agent_Audit_Log__c ORDER BY Seq__c ASC LIMIT 50000
        ];
        r.entries = rows.size();
        for (IB_Agent_Audit_Log__c e : rows) {
            String h = sha256(prev + '|' + canonical(e.Seq__c, e.Actor__c, e.Tool__c, e.Tmf_Api__c, e.Decision__c, e.Rule__c, e.Record_Id__c, e.Payload_Masked__c));
            if (e.Prev_Hash__c != prev || e.Hash__c != h) {
                r.ok = false;
                r.brokenAt = e.Seq__c;
                break;
            }
            prev = e.Hash__c;
        }
        return r;
    }
}
