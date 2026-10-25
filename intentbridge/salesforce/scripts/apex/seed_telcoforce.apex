// Telcoforce sample data (idempotent: upserts on external ids, resets the demo state). Fictional people and places.
upsert new List<Account>{
    new Account(Name = 'Tom Hughes', IB_Customer_Id__c = 'CUST-1005', IB_Billing_Account__c = 'BA-55005', IB_Postcode__c = 'LS6 1JD',
        IB_Current_Bill__c = 45.00, IB_Previous_Bill__c = 45.00, IB_Churn_Risk__c = 0.18, IB_Tenure_Months__c = 26),
    new Account(Name = 'Grace Lin', IB_Customer_Id__c = 'CUST-1006', IB_Billing_Account__c = 'BA-55006', IB_Postcode__c = 'LS6 4BB',
        IB_Current_Bill__c = 38.00, IB_Previous_Bill__c = 38.00, IB_SIM_Swap_Date__c = Date.today().addDays(-1), IB_Churn_Risk__c = 0.09, IB_Tenure_Months__c = 7)
} IB_Customer_Id__c;
upsert new List<IB_Partner__c>{
    new IB_Partner__c(Name = 'Brightwave Broadband', Partner_Id__c = 'PRT-301', Status__c = 'Active', Daily_Qualification_Limit__c = 250, Qualified_Today__c = 0,
        Max_Order_Lines__c = 50, Unit_Price__c = 21.50, Products__c = 'FTTP 900 wholesale; FTTP 300 wholesale', Kill_Switch__c = false),
    new IB_Partner__c(Name = 'QuickNet ISP', Partner_Id__c = 'PRT-302', Status__c = 'Suspended', Daily_Qualification_Limit__c = 250, Qualified_Today__c = 0,
        Max_Order_Lines__c = 50, Unit_Price__c = 21.50, Products__c = 'FTTP 300 wholesale', Kill_Switch__c = false),
    new IB_Partner__c(Name = 'Fibrely', Partner_Id__c = 'PRT-303', Status__c = 'Active', Daily_Qualification_Limit__c = 250, Qualified_Today__c = 0,
        Max_Order_Lines__c = 50, Unit_Price__c = 22.00, Products__c = 'FTTP 900 wholesale', Kill_Switch__c = false)
} Partner_Id__c;
Map<String, Id> acc = new Map<String, Id>();
for (Account a : [SELECT Id, IB_Customer_Id__c FROM Account WHERE IB_Customer_Id__c LIKE 'CUST-%' OR IB_Customer_Id__c LIKE 'ORG-%']) { acc.put(a.IB_Customer_Id__c, a.Id); }
List<IB_Fallout_Order__c> fo = new List<IB_Fallout_Order__c>();
for (List<Object> r : new List<List<Object>>{
        new List<Object>{ 'PO-77001', 'CUST-1004', 'ADDRESS_KEY_MISMATCH', 35.00, 35.00 },
        new List<Object>{ 'PO-77002', 'CUST-1001', 'PORT_RESERVATION_EXPIRED', 42.00, 42.00 },
        new List<Object>{ 'PO-77003', 'ORG-2001', 'PRICE_MISMATCH', 412.00, 389.00 },
        new List<Object>{ 'PO-77004', 'CUST-1002', 'LEGACY_OSS_NO_API', 30.00, 30.00 },
        new List<Object>{ 'PO-77005', 'CUST-1003', 'E-UNKNOWN-991', 40.00, 40.00 } }) {
    fo.add(new IB_Fallout_Order__c(Name = (String) r[0], Order_Id__c = (String) r[0], Account__c = acc.get((String) r[1]), Error_Code__c = (String) r[2],
        Amount__c = (Decimal) r[3], Catalogue_Price__c = (Decimal) r[4], State__c = 'failed', Repair_Path__c = null, Decision_Rule__c = null,
        Repair_Log__c = 'Fallout overnight: ' + r[2], OwnerId = UserInfo.getUserId()));
}
upsert fo Order_Id__c;
System.debug(LoggingLevel.ERROR, 'IBX|seed|Telcoforce seed: 2 LS6 accounts, 3 partners, ' + fo.size() + ' fallout orders');
