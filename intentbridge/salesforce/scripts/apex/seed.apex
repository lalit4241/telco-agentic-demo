// IntentBridge sample data (idempotent: upserts on external ids). Fictional people and places.
List<Account> accts = new List<Account>{
    new Account(Name = 'Sarah Mitchell', IB_Customer_Id__c = 'CUST-1001', IB_Billing_Account__c = 'BA-55001', IB_Postcode__c = 'LS6 3AB',
        IB_Current_Bill__c = 101.00, IB_Previous_Bill__c = 63.00, IB_Churn_Risk__c = 0.68, IB_Tenure_Months__c = 52, Phone = '07700 900123'),
    new Account(Name = 'Arthur Bennett', IB_Customer_Id__c = 'CUST-1002', IB_Billing_Account__c = 'BA-55002', IB_Postcode__c = 'LS6 2QT',
        IB_Current_Bill__c = 60.00, IB_Previous_Bill__c = 30.00, IB_Vulnerable__c = true, IB_Churn_Risk__c = 0.22, IB_Tenure_Months__c = 140),
    new Account(Name = 'Priya Shah', IB_Customer_Id__c = 'CUST-1003', IB_Billing_Account__c = 'BA-55003', IB_Postcode__c = 'B15 2TT',
        IB_Current_Bill__c = 40.00, IB_Previous_Bill__c = 40.00, IB_SIM_Swap_Date__c = Date.today().addDays(-1), IB_Churn_Risk__c = 0.12, IB_Tenure_Months__c = 18),
    new Account(Name = 'David Okafor', IB_Customer_Id__c = 'CUST-1004', IB_Billing_Account__c = 'BA-55004', IB_Postcode__c = 'M14 5RT',
        IB_Current_Bill__c = 120.50, IB_Previous_Bill__c = 48.00, IB_Churn_Risk__c = 0.41, IB_Tenure_Months__c = 30),
    new Account(Name = 'Northwind Logistics Ltd', IB_Customer_Id__c = 'ORG-2001', IB_Billing_Account__c = 'BA-90001', Industry = 'Transportation',
        Description = '40 depots across Great Britain. Account manager: James Whitaker.')
};
upsert accts IB_Customer_Id__c;
List<IB_Service_Problem__c> sps = new List<IB_Service_Problem__c>{
    new IB_Service_Problem__c(Name = 'LS6 broadband outage', Problem_Id__c = 'SP-7781', Postcode_District__c = 'LS6', Status__c = 'resolved',
        Impact__c = 'Full Fibre down for 1,240 premises for 3 days', Root_Cause__c = 'OLT line-card failure at Headingley exchange',
        Resource__c = 'OLT-LDS-HDY-03', Started__c = Datetime.now().addDays(-12), Customers_Affected__c = 1240),
    new IB_Service_Problem__c(Name = 'M14 cabinet fault', Problem_Id__c = 'SP-7790', Postcode_District__c = 'M14', Status__c = 'inProgress',
        Impact__c = 'FTTC cabinet without power, 310 premises', Root_Cause__c = 'Cabinet power-supply fault',
        Resource__c = 'CAB-MAN-FWD-17', Started__c = Datetime.now().addDays(-9), Customers_Affected__c = 310)
};
upsert sps Problem_Id__c;
System.debug('IntentBridge seed: ' + accts.size() + ' accounts, ' + sps.size() + ' service problems');
