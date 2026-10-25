// Telcoforce demo reset: removes only the records the Telcoforce exercise creates (the audit log is append-only and is kept),
// so the exercise scripts can be replayed from a clean state. Run seed_telcoforce.apex afterwards.
List<IB_Service_Problem__c> sp = [SELECT Id FROM IB_Service_Problem__c WHERE Problem_Id__c LIKE 'SP-ALM-%'];
delete [SELECT Id FROM IB_Customer_Notification__c WHERE Service_Problem__c IN :sp];
delete [SELECT Id FROM IB_Credit_Adjustment__c WHERE Service_Problem__c IN :sp];
delete [SELECT Id FROM IB_Wholesale_Order__c];
delete sp;
System.debug(LoggingLevel.ERROR, 'IBX|reset|Telcoforce demo records cleared');
