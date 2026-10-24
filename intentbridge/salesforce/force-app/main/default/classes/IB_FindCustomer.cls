/**
 * IntentBridge: resolve a customer from a name, customer id (CUST-1001 / ORG-2001) or billing account (BA-55001)
 * so agents can pass an Account Id to the other actions. TMF629 Customer / TMF666 Account lookup (mocked on Account).
 */
public with sharing class IB_FindCustomer {
    public class Request {
        @InvocableVariable(label='Search term' description='Customer name, customer id (e.g. CUST-1004, ORG-2001) or billing account (e.g. BA-55004)' required=true) public String searchTerm;
    }
    public class Result {
        @InvocableVariable(label='Found') public Boolean found;
        @InvocableVariable(label='Account Id') public Id accountId;
        @InvocableVariable(label='Customer name') public String customerName;
        @InvocableVariable(label='Customer id') public String customerId;
        @InvocableVariable(label='Vulnerable customer flag') public Boolean vulnerable;
        @InvocableVariable(label='Summary') public String summary;
    }

    @InvocableMethod(label='IB Find Customer' description='Finds a telco customer by name, customer id or billing account and returns the Account Id needed by the other IntentBridge actions.' category='IntentBridge')
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request rq : requests) {
            Result r = new Result();
            r.found = false;
            String t = rq.searchTerm == null ? '' : rq.searchTerm.trim();
            List<Account> hits = new List<Account>();
            if (t.length() >= 2) {
                String pattern = '%' + t + '%';
                hits = [SELECT Id, Name, IB_Customer_Id__c, IB_Vulnerable__c FROM Account
                        WHERE IB_Customer_Id__c != null AND (IB_Customer_Id__c = :t OR IB_Billing_Account__c = :t OR Name LIKE :pattern)
                        ORDER BY Name LIMIT 5];
            }
            if (hits.size() == 1) {
                Account a = hits[0];
                r.found = true; r.accountId = a.Id; r.customerName = a.Name; r.customerId = a.IB_Customer_Id__c; r.vulnerable = a.IB_Vulnerable__c;
                r.summary = 'Found ' + a.Name + ' (' + a.IB_Customer_Id__c + ').';
            } else if (hits.isEmpty()) {
                r.summary = 'No customer matched "' + t + '". Ask for the customer id or billing account number.';
            } else {
                List<String> names = new List<String>();
                for (Account a : hits) { names.add(a.Name + ' (' + a.IB_Customer_Id__c + ')'); }
                r.summary = 'Several customers matched: ' + String.join(names, ', ') + '. Ask which one.';
            }
            out.add(r);
        }
        return out;
    }
}