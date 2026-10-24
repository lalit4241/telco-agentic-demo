@IsTest
private class IB_IntentBridge_Test {

    @TestSetup
    static void setup() {
        insert new List<Account>{
            new Account(Name = 'Sarah Mitchell', IB_Customer_Id__c = 'CUST-1001', IB_Billing_Account__c = 'BA-55001', IB_Postcode__c = 'LS6 3AB',
                IB_Current_Bill__c = 101.00, IB_Previous_Bill__c = 63.00, IB_Churn_Risk__c = 0.68, IB_Tenure_Months__c = 52),
            new Account(Name = 'David Okafor', IB_Customer_Id__c = 'CUST-1004', IB_Billing_Account__c = 'BA-55004', IB_Postcode__c = 'M14 5RT',
                IB_Current_Bill__c = 120.50, IB_Previous_Bill__c = 48.00, IB_Churn_Risk__c = 0.41),
            new Account(Name = 'Arthur Bennett', IB_Customer_Id__c = 'CUST-1002', IB_Billing_Account__c = 'BA-55002', IB_Postcode__c = 'LS6 2QT',
                IB_Current_Bill__c = 60.00, IB_Previous_Bill__c = 30.00, IB_Vulnerable__c = true, IB_Churn_Risk__c = 0.2),
            new Account(Name = 'Priya Shah', IB_Customer_Id__c = 'CUST-1003', IB_Billing_Account__c = 'BA-55003', IB_Postcode__c = 'B15 2TT',
                IB_Current_Bill__c = 40.00, IB_Previous_Bill__c = 40.00, IB_SIM_Swap_Date__c = Date.today().addDays(-1), IB_Churn_Risk__c = 0.1),
            new Account(Name = 'Northwind Logistics Ltd', IB_Customer_Id__c = 'ORG-2001', IB_Billing_Account__c = 'BA-90001')
        };
        insert new List<IB_Service_Problem__c>{
            new IB_Service_Problem__c(Name = 'LS6 broadband outage', Problem_Id__c = 'SP-7781', Postcode_District__c = 'LS6', Status__c = 'resolved',
                Root_Cause__c = 'OLT line-card failure at Headingley exchange', Resource__c = 'OLT-LDS-HDY-03', Started__c = Datetime.now().addDays(-12)),
            new IB_Service_Problem__c(Name = 'M14 cabinet fault', Problem_Id__c = 'SP-7790', Postcode_District__c = 'M14', Status__c = 'inProgress',
                Root_Cause__c = 'Cabinet power fault', Resource__c = 'CAB-MAN-FWD-17', Started__c = Datetime.now().addDays(-9))
        };
    }

    static Account acct(String cid) { return [SELECT Id FROM Account WHERE IB_Customer_Id__c = :cid]; }

    @IsTest
    static void slaFeasibilityFlagsThreeSites() {
        IB_CheckSlaFeasibility.Request rq = new IB_CheckSlaFeasibility.Request();
        rq.accountId = acct('ORG-2001').Id;
        rq.siteCount = 40;
        rq.availabilityTarget = 99.95;
        rq.latencyMs = 30;
        Test.startTest();
        IB_CheckSlaFeasibility.Result r = IB_CheckSlaFeasibility.run(new List<IB_CheckSlaFeasibility.Request>{ rq })[0];
        Test.stopTest();
        System.assertEquals(40, r.sitesRequested);
        System.assertEquals(37, r.sitesFeasible);
        System.assertEquals('NW-S13, NW-S31, NW-S37', r.infeasibleSites);
        IB_Intent__c i = [SELECT Lifecycle_Status__c, Expression__c FROM IB_Intent__c WHERE Id = :r.intentId];
        System.assertEquals('assessed', i.Lifecycle_Status__c);
        System.assert(i.Expression__c.contains('JsonLdExpression'));
    }

    @IsTest
    static void slaFeasibilityWithSiteListAndDefaults() {
        IB_CheckSlaFeasibility.Request rq = new IB_CheckSlaFeasibility.Request();
        rq.accountId = acct('ORG-2001').Id;
        rq.siteList = 'nw-s01, NW-S02,,';
        IB_CheckSlaFeasibility.Result r = IB_CheckSlaFeasibility.run(new List<IB_CheckSlaFeasibility.Request>{ rq })[0];
        System.assertEquals(2, r.sitesFeasible);
        System.assertEquals('', r.infeasibleSites);
        rq.siteList = 'NW-S01';
        rq.latencyMs = 5;
        r = IB_CheckSlaFeasibility.run(new List<IB_CheckSlaFeasibility.Request>{ rq })[0];
        System.assertEquals(0, r.sitesFeasible);
    }

    @IsTest
    static void billShockLinksNetworkFault() {
        IB_DiagnoseBillShock.Request rq = new IB_DiagnoseBillShock.Request();
        rq.accountId = acct('CUST-1001').Id;
        IB_DiagnoseBillShock.Result r = IB_DiagnoseBillShock.run(new List<IB_DiagnoseBillShock.Request>{ rq })[0];
        System.assert(r.increase == 38);
        System.assertEquals(true, r.withinCap);
        System.assertEquals(false, r.needsHuman);
        System.assertNotEquals(null, r.serviceProblemId);
        System.assert(r.explanation.contains('SP-7781'));
    }

    @IsTest
    static void billShockOtherCases() {
        List<IB_DiagnoseBillShock.Request> rqs = new List<IB_DiagnoseBillShock.Request>();
        for (String cid : new List<String>{ 'CUST-1004', 'CUST-1002', 'CUST-1003' }) {
            IB_DiagnoseBillShock.Request rq = new IB_DiagnoseBillShock.Request();
            rq.accountId = acct(cid).Id;
            rqs.add(rq);
        }
        IB_DiagnoseBillShock.Request missing = new IB_DiagnoseBillShock.Request();
        missing.accountId = IB_IntentBridge_Test.fakeAccountId();
        rqs.add(missing);
        List<IB_DiagnoseBillShock.Result> rs = IB_DiagnoseBillShock.run(rqs);
        System.assert(rs[0].increase == 72.5);
        System.assertEquals(false, rs[0].withinCap);
        System.assertEquals(true, rs[1].needsHuman, 'vulnerable');
        System.assert(rs[1].suggestedCredit == 30, 'LS6 fault applies to Arthur too, but a human must handle it');
        System.assertEquals(true, rs[2].needsHuman, 'SIM swap');
        System.assert(rs[2].explanation.contains('not increased'));
        System.assertEquals('Account not found.', rs[3].explanation);
    }

    static Id fakeAccountId() { return Id.valueOf('001' + '0'.repeat(12)); }

    @IsTest
    static void creditWithinCapIsApplied() {
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1001').Id;
        rq.amount = 38;
        rq.reason = 'Out-of-bundle data during SP-7781';
        IB_RequestCreditAdjustment.Result r = IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0];
        System.assertEquals('Applied', r.status);
        System.assertEquals('WITHIN_CAP', r.rule);
        IB_Credit_Adjustment__c c = [SELECT Tmf678_Adjustment_Id__c FROM IB_Credit_Adjustment__c WHERE Id = :r.creditId];
        System.assert(c.Tmf678_Adjustment_Id__c.startsWith('ADJ-'));
    }

    @IsTest
    static void creditAboveCapGoesToSupervisorAndCanBeApproved() {
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1004').Id;
        rq.amount = 72.50;
        rq.reason = 'Out-of-bundle data during SP-7790';
        IB_RequestCreditAdjustment.Result r = IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0];
        System.assertEquals('Pending Approval', r.status);
        System.assertEquals('CREDIT_CAP', r.rule);
        IB_Credit_Adjustment__c c = [SELECT OwnerId FROM IB_Credit_Adjustment__c WHERE Id = :r.creditId];
        Id q = IB_RequestCreditAdjustment.supervisorQueueId();
        if (q != null) { System.assertEquals(q, c.OwnerId); }

        IB_ApproveCredit.Request ap = new IB_ApproveCredit.Request();
        ap.creditId = r.creditId;
        ap.approve = true;
        ap.comment = 'Fault confirmed';
        Test.startTest();
        IB_ApproveCredit.Result ar = IB_ApproveCredit.run(new List<IB_ApproveCredit.Request>{ ap })[0];
        Test.stopTest();
        System.assertEquals('Approved', ar.status);
        // Second decision on the same credit is refused
        IB_ApproveCredit.Result again = IB_ApproveCredit.run(new List<IB_ApproveCredit.Request>{ ap })[0];
        System.assertEquals('Approved', again.status);
        System.assert(again.message.contains('Only credits'));
    }

    @IsTest
    static void vulnerableCustomerCreditIsHeldAndCanBeRejected() {
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1002').Id;
        rq.amount = 10;
        rq.reason = 'Goodwill';
        rq.agentName = 'Coworker';
        IB_RequestCreditAdjustment.Result r = IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0];
        System.assertEquals('VULNERABLE_CUSTOMER', r.rule);
        IB_ApproveCredit.Request ap = new IB_ApproveCredit.Request();
        ap.creditId = r.creditId;
        ap.approve = false;
        System.assertEquals('Rejected', IB_ApproveCredit.run(new List<IB_ApproveCredit.Request>{ ap })[0].status);
    }

    @IsTest
    static void invalidCreditRequestIsRejected() {
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1001').Id;
        rq.amount = -5;
        rq.reason = 'x';
        System.assertEquals('INVALID_REQUEST', IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0].rule);
    }

    @IsTest
    static void policyOverrideChangesCap() {
        IB_TrustPolicy p = new IB_TrustPolicy();
        p.autoCreditCap = 100;
        IB_TrustPolicy.testOverride = p;
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1004').Id;
        rq.amount = 72.50;
        rq.reason = 'x';
        System.assertEquals('Applied', IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0].status);
    }

    @IsTest
    static void retentionOffers() {
        List<IB_ProposeRetentionOffer.Request> rqs = new List<IB_ProposeRetentionOffer.Request>();
        for (String cid : new List<String>{ 'CUST-1001', 'CUST-1004', 'CUST-1003', 'CUST-1002' }) {
            IB_ProposeRetentionOffer.Request rq = new IB_ProposeRetentionOffer.Request();
            rq.accountId = acct(cid).Id;
            rqs.add(rq);
        }
        IB_ProposeRetentionOffer.Request missing = new IB_ProposeRetentionOffer.Request();
        missing.accountId = fakeAccountId();
        rqs.add(missing);
        List<IB_ProposeRetentionOffer.Result> rs = IB_ProposeRetentionOffer.run(rqs);
        System.assertEquals('PO-RET-UNL3', rs[0].offerCode);
        System.assertEquals(false, rs[0].requiresHuman);
        System.assertEquals('PO-RET-5OFF', rs[1].offerCode);
        System.assertEquals('PO-RET-BOOST', rs[2].offerCode);
        System.assertEquals(true, rs[3].requiresHuman, 'vulnerable');
        System.assertEquals('Account not found.', rs[4].guidance);
    }

    @IsTest
    static void auditChainVerifiesAndDetectsTampering() {
        IB_AuditService.log('agent:test', 'customer.get', 'TMF629', 'allow', 'READ_IN_SCOPE', null,
            new Map<String, Object>{ 'email' => 'sarah.mitchell@example.co.uk', 'phone' => '07700 900123', 'postcode' => 'LS6 3AB' });
        IB_AuditService.log('agent:test', 'bill.list', 'TMF678', 'allow', 'READ_IN_SCOPE', null, 'plain text payload');
        IB_AuditService.log('agent:test', 'noop', null, 'deny', 'OUT_OF_SCOPE', null, null);
        IB_AuditService.VerifyResult v = IB_AuditService.verify();
        System.assertEquals(true, v.ok);
        System.assertEquals(3, v.entries);
        IB_Agent_Audit_Log__c first = [SELECT Id, Payload_Masked__c FROM IB_Agent_Audit_Log__c WHERE Seq__c = 1];
        System.assert(!first.Payload_Masked__c.contains('sarah.mitchell'));
        System.assert(!first.Payload_Masked__c.contains('900123'));
        System.assert(first.Payload_Masked__c.contains('LS6 ***'));
        first.Payload_Masked__c = 'tampered';
        update first;
        v = IB_AuditService.verify();
        System.assertEquals(false, v.ok);
        System.assert(v.brokenAt == 1);
    }

    @IsTest
    static void trustPolicyAndHelpers() {
        IB_TrustPolicy.cached = null;
        IB_TrustPolicy p = IB_TrustPolicy.get();
        System.assert(p.autoCreditCap == 50);
        System.assertEquals(p, IB_TrustPolicy.get());
        System.assertEquals(90, IB_TrustPolicy.simSwapRisk(Date.today().addDays(-1), true, true));
        System.assertEquals(30, IB_TrustPolicy.simSwapRisk(Date.today().addDays(-5), false, false));
        System.assertEquals(0, IB_TrustPolicy.simSwapRisk(null, true, true));
        System.assertEquals(0, IB_TrustPolicy.simSwapRisk(Date.today().addDays(-30), true, true));
        System.assertEquals(null, IB_TmfMockService.findServiceProblem(null));
        System.assertEquals(null, IB_AuditService.maskPII(null));
        System.assertEquals(64, IB_AuditService.sha256('abc').length());
        System.assertEquals('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', IB_AuditService.sha256('abc'));
    }

    @IsTest
    static void simSwapRiskHoldsCreditForStepUp() {
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1003').Id;
        rq.amount = 5;
        rq.reason = 'Goodwill';
        IB_RequestCreditAdjustment.Result r = IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq })[0];
        System.assertEquals('SIM_SWAP_RISK', r.rule);
        System.assertEquals('Pending Approval', r.status);
        IB_Credit_Adjustment__c c = [SELECT OwnerId, Tmf678_Adjustment_Id__c FROM IB_Credit_Adjustment__c WHERE Id = :r.creditId];
        System.assertEquals(IB_RequestCreditAdjustment.supervisorQueueId(), c.OwnerId);
        System.assertEquals(null, c.Tmf678_Adjustment_Id__c, 'nothing applied before verification');
    }

    @IsTest
    static void billShockWithoutFaultSuggestsNoCredit() {
        Account a = new Account(Name = 'No Fault', IB_Customer_Id__c = 'CUST-1999', IB_Billing_Account__c = 'BA-55999', IB_Postcode__c = 'EX1 1AA',
            IB_Current_Bill__c = 55.00, IB_Previous_Bill__c = 45.00);
        insert a;
        IB_DiagnoseBillShock.Request rq = new IB_DiagnoseBillShock.Request();
        rq.accountId = a.Id;
        IB_DiagnoseBillShock.Result r = IB_DiagnoseBillShock.run(new List<IB_DiagnoseBillShock.Request>{ rq })[0];
        System.assert(r.increase == 10);
        System.assert(r.suggestedCredit == 0);
        System.assertEquals(null, r.serviceProblemId);
        System.assert(r.explanation.contains('No network fault'));
    }

    @IsTest
    static void findCustomerByIdNameAndAmbiguity() {
        List<IB_FindCustomer.Request> rqs = new List<IB_FindCustomer.Request>();
        for (String t : new List<String>{ 'CUST-1004', 'Sarah', 'BA-55002', 'Nobody Here', 'a' }) {
            IB_FindCustomer.Request rq = new IB_FindCustomer.Request(); rq.searchTerm = t; rqs.add(rq);
        }
        List<IB_FindCustomer.Result> rs = IB_FindCustomer.run(rqs);
        System.assertEquals(acct('CUST-1004').Id, rs[0].accountId);
        System.assertEquals('CUST-1001', rs[1].customerId);
        System.assertEquals(true, rs[2].vulnerable);
        System.assertEquals(false, rs[3].found);
        System.assertEquals(false, rs[4].found);
        System.assert(rs[4].summary.contains('matched'));
        IB_FindCustomer.Request many = new IB_FindCustomer.Request(); many.searchTerm = 'ah';
        IB_FindCustomer.Result m = IB_FindCustomer.run(new List<IB_FindCustomer.Request>{ many })[0];
        System.assertEquals(false, m.found);
        System.assert(m.summary.startsWith('Several'));
    }

    @IsTest
    static void listPendingCreditsShowsHeldItems() {
        IB_ListPendingCredits.Request none = new IB_ListPendingCredits.Request();
        System.assertEquals(0, IB_ListPendingCredits.run(new List<IB_ListPendingCredits.Request>{ none })[0].pendingCount);
        IB_RequestCreditAdjustment.Request rq = new IB_RequestCreditAdjustment.Request();
        rq.accountId = acct('CUST-1004').Id; rq.amount = 72.50; rq.reason = 'Fault SP-7790';
        IB_RequestCreditAdjustment.run(new List<IB_RequestCreditAdjustment.Request>{ rq });
        IB_ListPendingCredits.Request f = new IB_ListPendingCredits.Request(); f.customerFilter = 'David';
        IB_ListPendingCredits.Result r = IB_ListPendingCredits.run(new List<IB_ListPendingCredits.Request>{ f })[0];
        System.assertEquals(1, r.pendingCount);
        System.assert(r.summary.contains('72.50'));
        System.assert(r.pendingJson.contains('CREDIT_CAP'));
    }
}
