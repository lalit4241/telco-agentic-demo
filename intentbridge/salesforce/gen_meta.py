# Generates object/field/permset metadata for the IntentBridge SFDX package.
import os
B = 'force-app/main/default'
NS = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
def w(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n' + s.strip() + '\n')
def field(obj, name, label, ftype, extra='', desc=''):
    if ftype == 'Text': body = '<length>%s</length>' % (extra or 255)
    elif ftype == 'TextExt': body = '<length>80</length><externalId>true</externalId><unique>true</unique>'
    elif ftype == 'LongTextArea': body = '<length>32768</length><visibleLines>6</visibleLines>'
    elif ftype == 'Number': body = '<precision>18</precision><scale>%s</scale>' % (extra or 0)
    elif ftype == 'Currency': body = '<precision>16</precision><scale>2</scale>'
    elif ftype == 'Checkbox': body = '<defaultValue>false</defaultValue>'
    elif ftype == 'Lookup': body = '<referenceTo>%s</referenceTo><relationshipName>%s</relationshipName><deleteConstraint>SetNull</deleteConstraint>' % extra
    elif ftype == 'Picklist': body = '<valueSet><restricted>true</restricted><valueSetDefinition><sorted>false</sorted>' + ''.join('<value><fullName>%s</fullName><default>%s</default><label>%s</label></value>' % (v, 'true' if i == 0 else 'false', v) for i, v in enumerate(extra)) + '</valueSetDefinition></valueSet>'
    else: body = ''
    t = {'TextExt': 'Text'}.get(ftype, ftype)
    w('%s/objects/%s/fields/%s.field-meta.xml' % (B, obj, name),
      '<CustomField %s><fullName>%s</fullName><label>%s</label>%s<type>%s</type>%s</CustomField>' % (NS, name, label, ('<description>%s</description>' % desc) if desc else '', t, body))
    return (obj, name, ftype)

def obj(api, label, plural, name_field, desc):
    nf = '<nameField><label>%s</label><type>AutoNumber</type><displayFormat>%s</displayFormat><startingNumber>1</startingNumber></nameField>' % name_field if isinstance(name_field, tuple) else '<nameField><label>%s</label><type>Text</type></nameField>' % name_field
    w('%s/objects/%s/%s.object-meta.xml' % (B, api, api), '''
<CustomObject %s>
  <label>%s</label><pluralLabel>%s</pluralLabel>%s
  <description>%s</description>
  <deploymentStatus>Deployed</deploymentStatus><sharingModel>ReadWrite</sharingModel>
  <enableActivities>false</enableActivities><enableHistory>true</enableHistory><enableReports>true</enableReports><enableSearch>true</enableSearch>
  <enableBulkApi>true</enableBulkApi><enableSharing>true</enableSharing><enableStreamingApi>true</enableStreamingApi>
</CustomObject>''' % (NS, label, plural, nf, desc))
    if not os.path.exists('%s/tabs/%s.tab-meta.xml' % (B, api)): w('%s/tabs/%s.tab-meta.xml' % (B, api), '<CustomTab %s><customObject>true</customObject><motif>Custom57: Building Block</motif></CustomTab>' % NS)

F = []
obj('IB_Intent__c', 'IB Intent', 'IB Intents', 'Intent Name', 'TMF921 intent mirrored from the network-domain intent handler (probe, assessed, active).')
F += [field('IB_Intent__c', 'Account__c', 'Account', 'Lookup', ('Account', 'IB_Intents')),
      field('IB_Intent__c', 'Lifecycle_Status__c', 'Lifecycle Status', 'Picklist', ['probe', 'assessed', 'active', 'rejected', 'cancelled']),
      field('IB_Intent__c', 'Tmf_Intent_Id__c', 'TMF921 Intent Id', 'Text', 80),
      field('IB_Intent__c', 'Availability_Target__c', 'Availability Target %', 'Number', 3),
      field('IB_Intent__c', 'Latency_Ms__c', 'Latency Target (ms)', 'Number', 0),
      field('IB_Intent__c', 'Sites_Requested__c', 'Sites Requested', 'Number', 0),
      field('IB_Intent__c', 'Sites_Feasible__c', 'Sites Feasible', 'Number', 0),
      field('IB_Intent__c', 'Infeasible_Sites__c', 'Infeasible Sites', 'LongTextArea'),
      field('IB_Intent__c', 'Expression__c', 'Intent Expression (JSON-LD)', 'LongTextArea'),
      field('IB_Intent__c', 'Intent_Report__c', 'Intent Report', 'LongTextArea')]
obj('IB_Service_Problem__c', 'IB Service Problem', 'IB Service Problems', 'Problem Number', 'TMF656 service problem mirrored from OSS assurance.')
F += [field('IB_Service_Problem__c', 'Problem_Id__c', 'TMF656 Problem Id', 'TextExt'),
      field('IB_Service_Problem__c', 'Postcode_District__c', 'Postcode District', 'Text', 10),
      field('IB_Service_Problem__c', 'Status__c', 'Status', 'Picklist', ['acknowledged', 'inProgress', 'resolved', 'closed']),
      field('IB_Service_Problem__c', 'Impact__c', 'Impact', 'Text', 255),
      field('IB_Service_Problem__c', 'Root_Cause__c', 'Root Cause', 'Text', 255),
      field('IB_Service_Problem__c', 'Resource__c', 'Affected Resource', 'Text', 80),
      field('IB_Service_Problem__c', 'Started__c', 'Started', 'DateTime'),
      field('IB_Service_Problem__c', 'Customers_Affected__c', 'Customers Affected', 'Number', 0)]
obj('IB_Credit_Adjustment__c', 'IB Credit Adjustment Request', 'IB Credit Adjustment Requests', ('Request Number', 'CR-{00000}'), 'Bill credit requested by an agent. At or under the trust-policy cap it is applied; above the cap (or for vulnerable customers) it waits in the IB Supervisor queue.')
F += [field('IB_Credit_Adjustment__c', 'Account__c', 'Account', 'Lookup', ('Account', 'IB_Credit_Adjustments')),
      field('IB_Credit_Adjustment__c', 'Service_Problem__c', 'Service Problem', 'Lookup', ('IB_Service_Problem__c', 'Credit_Adjustments')),
      field('IB_Credit_Adjustment__c', 'Amount__c', 'Amount', 'Currency'),
      field('IB_Credit_Adjustment__c', 'Reason__c', 'Reason', 'Text', 255),
      field('IB_Credit_Adjustment__c', 'Status__c', 'Status', 'Picklist', ['Pending Approval', 'Applied', 'Approved', 'Rejected']),
      field('IB_Credit_Adjustment__c', 'Decision_Rule__c', 'Decision Rule', 'Text', 80),
      field('IB_Credit_Adjustment__c', 'Requested_By_Agent__c', 'Requested By (agent)', 'Text', 80),
      field('IB_Credit_Adjustment__c', 'Decided_By__c', 'Decided By', 'Lookup', ('User', 'IB_Credit_Decisions')),
      field('IB_Credit_Adjustment__c', 'Decision_Comment__c', 'Decision Comment', 'Text', 255),
      field('IB_Credit_Adjustment__c', 'Tmf678_Adjustment_Id__c', 'Billing Adjustment Id', 'Text', 80)]
obj('IB_Agent_Audit_Log__c', 'IB Agent Audit Log', 'IB Agent Audit Logs', ('Entry', 'AUD-{000000}'), 'Hash-chained (SHA-256) record of every agent tool call and human decision. PII is masked before it is written.')
F += [field('IB_Agent_Audit_Log__c', 'Seq__c', 'Sequence', 'Number', 0),
      field('IB_Agent_Audit_Log__c', 'Actor__c', 'Actor', 'Text', 120),
      field('IB_Agent_Audit_Log__c', 'Tool__c', 'Tool', 'Text', 120),
      field('IB_Agent_Audit_Log__c', 'Tmf_Api__c', 'TMF API', 'Text', 20),
      field('IB_Agent_Audit_Log__c', 'Decision__c', 'Decision', 'Picklist', ['allow', 'deny', 'escalate', 'approved', 'rejected']),
      field('IB_Agent_Audit_Log__c', 'Rule__c', 'Rule', 'Text', 80),
      field('IB_Agent_Audit_Log__c', 'Record_Id__c', 'Related Record Id', 'Text', 18),
      field('IB_Agent_Audit_Log__c', 'Payload_Masked__c', 'Payload (masked)', 'LongTextArea'),
      field('IB_Agent_Audit_Log__c', 'Hash__c', 'Hash', 'Text', 64),
      field('IB_Agent_Audit_Log__c', 'Prev_Hash__c', 'Previous Hash', 'Text', 64)]
F += [field('Account', 'IB_Customer_Id__c', 'IB Customer Id', 'TextExt', '', 'TMF629 customer id in the BSS'),
      field('Account', 'IB_Billing_Account__c', 'IB Billing Account', 'Text', 40),
      field('Account', 'IB_Postcode__c', 'IB Postcode', 'Text', 10),
      field('Account', 'IB_Vulnerable__c', 'IB Vulnerable Customer', 'Checkbox', '', 'Ofcom fair-treatment flag: agents must hand off to a human'),
      field('Account', 'IB_SIM_Swap_Date__c', 'IB Last SIM Swap', 'Date'),
      field('Account', 'IB_Churn_Risk__c', 'IB Churn Risk', 'Number', 2),
      field('Account', 'IB_Current_Bill__c', 'IB Current Bill', 'Currency'),
      field('Account', 'IB_Previous_Bill__c', 'IB Previous Bill', 'Currency'),
      field('Account', 'IB_Tenure_Months__c', 'IB Tenure (months)', 'Number', 0)]

# ---------- Telcoforce extension objects ----------
obj('IB_Partner__c', 'IB Wholesale Partner', 'IB Wholesale Partners', 'Partner Name', 'TMF668 wholesale partner and its agreement. The partner\'s own agent calls in over A2A; the agreement meters what it may do.')
F += [field('IB_Partner__c', 'Partner_Id__c', 'Partner Id', 'TextExt'),
      field('IB_Partner__c', 'Status__c', 'Agreement Status', 'Picklist', ['Active', 'Suspended']),
      field('IB_Partner__c', 'Daily_Qualification_Limit__c', 'Daily Qualification Limit', 'Number', 0),
      field('IB_Partner__c', 'Qualified_Today__c', 'Qualified Today', 'Number', 0),
      field('IB_Partner__c', 'Max_Order_Lines__c', 'Max Lines per Order', 'Number', 0),
      field('IB_Partner__c', 'Unit_Price__c', 'Wholesale Unit Price (monthly)', 'Currency'),
      field('IB_Partner__c', 'Products__c', 'Entitled Products', 'Text', 255),
      field('IB_Partner__c', 'Kill_Switch__c', 'Agent Kill Switch', 'Checkbox', '', 'Agent Fabric kill switch: when ticked every call from this partner\'s agent is refused')]
obj('IB_Wholesale_Order__c', 'IB Wholesale Order', 'IB Wholesale Orders', ('Order Number', 'WO-{00000}'), 'TMF622 order placed by a partner agent over A2A, inside the agreement.')
F += [field('IB_Wholesale_Order__c', 'Partner__c', 'Partner', 'Lookup', ('IB_Partner__c', 'Wholesale_Orders')),
      field('IB_Wholesale_Order__c', 'Product__c', 'Product', 'Text', 80),
      field('IB_Wholesale_Order__c', 'Lines__c', 'Lines', 'Number', 0),
      field('IB_Wholesale_Order__c', 'Monthly_Value__c', 'Monthly Value', 'Currency'),
      field('IB_Wholesale_Order__c', 'Status__c', 'Status', 'Picklist', ['Acknowledged', 'Pending Partner Desk', 'Rejected']),
      field('IB_Wholesale_Order__c', 'Decision_Rule__c', 'Decision Rule', 'Text', 80)]
obj('IB_Fallout_Order__c', 'IB Fallout Order', 'IB Fallout Orders', 'Order Name', 'TMF622 product order that failed in fulfilment. The back-office agent repairs it with an approved playbook or hands it to the ops lead.')
F += [field('IB_Fallout_Order__c', 'Order_Id__c', 'Product Order Id', 'TextExt'),
      field('IB_Fallout_Order__c', 'Account__c', 'Account', 'Lookup', ('Account', 'IB_Fallout_Orders')),
      field('IB_Fallout_Order__c', 'Error_Code__c', 'Fallout Error Code', 'Text', 80),
      field('IB_Fallout_Order__c', 'State__c', 'State', 'Picklist', ['failed', 'inProgress', 'held', 'completed']),
      field('IB_Fallout_Order__c', 'Repair_Path__c', 'Repair Path', 'Text', 80),
      field('IB_Fallout_Order__c', 'Decision_Rule__c', 'Decision Rule', 'Text', 80),
      field('IB_Fallout_Order__c', 'Amount__c', 'Order Price (monthly)', 'Currency'),
      field('IB_Fallout_Order__c', 'Catalogue_Price__c', 'Catalogue Price (monthly)', 'Currency'),
      field('IB_Fallout_Order__c', 'Repair_Log__c', 'Repair Log', 'LongTextArea')]
obj('IB_Customer_Notification__c', 'IB Customer Notification', 'IB Customer Notifications', ('Notification Number', 'CN-{00000}'), 'TMF681 proactive message about a network event. Vulnerable customers get a call from a person instead.')
F += [field('IB_Customer_Notification__c', 'Account__c', 'Account', 'Lookup', ('Account', 'IB_Notifications')),
      field('IB_Customer_Notification__c', 'Service_Problem__c', 'Service Problem', 'Lookup', ('IB_Service_Problem__c', 'Notifications')),
      field('IB_Customer_Notification__c', 'Template__c', 'Template', 'Text', 80),
      field('IB_Customer_Notification__c', 'Channel__c', 'Channel', 'Picklist', ['sms', 'email', 'app', 'human-call']),
      field('IB_Customer_Notification__c', 'Status__c', 'Status', 'Picklist', ['Sent', 'Pending Human Call', 'Called']),
      field('IB_Customer_Notification__c', 'Decision_Rule__c', 'Decision Rule', 'Text', 80),
      field('IB_Customer_Notification__c', 'Message__c', 'Message', 'Text', 255)]

# Custom metadata type
w('%s/objects/IB_Trust_Policy__mdt/IB_Trust_Policy__mdt.object-meta.xml' % B, '<CustomObject %s><label>IB Trust Policy</label><pluralLabel>IB Trust Policies</pluralLabel><visibility>Public</visibility><description>Trust-pack thresholds read by the IntentBridge actions.</description></CustomObject>' % NS)
for n, l, sc in [('Auto_Credit_Cap__c', 'Auto Credit Cap', 2), ('Discount_Authority_Pct__c', 'Discount Authority %', 2), ('SLA_Target__c', 'SLA Target %', 3), ('Sim_Swap_Threshold__c', 'SIM Swap Risk Threshold', 0)]:
    w('%s/objects/IB_Trust_Policy__mdt/fields/%s.field-meta.xml' % (B, n), '<CustomField %s><fullName>%s</fullName><label>%s</label><fieldManageability>SubscriberControlled</fieldManageability><precision>8</precision><scale>%d</scale><type>Number</type></CustomField>' % (NS, n, l, sc))
w('%s/customMetadata/IB_Trust_Policy.Default.md-meta.xml' % B, '''
<CustomMetadata %s xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <label>Default</label><protected>false</protected>
  <values><field>Auto_Credit_Cap__c</field><value xsi:type="xsd:double">50</value></values>
  <values><field>Discount_Authority_Pct__c</field><value xsi:type="xsd:double">10</value></values>
  <values><field>SLA_Target__c</field><value xsi:type="xsd:double">99.95</value></values>
  <values><field>Sim_Swap_Threshold__c</field><value xsi:type="xsd:double">70</value></values>
</CustomMetadata>''' % NS)

# Queue
w('%s/queues/IB_Supervisor.queue-meta.xml' % B, '<Queue %s><name>IB Supervisor</name><doesSendEmailToMembers>false</doesSendEmailToMembers>' % NS + ''.join('<queueSobject><sobjectType>%s</sobjectType></queueSobject>' % o for o in ['IB_Credit_Adjustment__c', 'IB_Wholesale_Order__c', 'IB_Fallout_Order__c', 'IB_Customer_Notification__c']) + '</Queue>')

# Permission set
classes = ['IB_TrustPolicy', 'IB_AuditService', 'IB_TmfMockService', 'IB_CheckSlaFeasibility', 'IB_DiagnoseBillShock', 'IB_ProposeRetentionOffer', 'IB_RequestCreditAdjustment', 'IB_ApproveCredit', 'IB_FindCustomer', 'IB_ListPendingCredits',
           'IB_DetectOutageImpact', 'IB_NotifyAffected', 'IB_RestoreAndCredit', 'IB_PartnerQualify', 'IB_PartnerOrder', 'IB_SetPartnerKillSwitch', 'IB_RepairFalloutOrder', 'IB_RouteRequest', 'IB_TelcoforceService']
objs = ['IB_Intent__c', 'IB_Service_Problem__c', 'IB_Credit_Adjustment__c', 'IB_Agent_Audit_Log__c', 'IB_Partner__c', 'IB_Wholesale_Order__c', 'IB_Fallout_Order__c', 'IB_Customer_Notification__c']
ps = '<PermissionSet %s><label>IB IntentBridge User</label><description>Access to IntentBridge objects, fields, tabs and agent actions.</description><hasActivationRequired>false</hasActivationRequired>' % NS
ps += ''.join('<classAccesses><apexClass>%s</apexClass><enabled>true</enabled></classAccesses>' % c for c in classes)
ps += '<customMetadataTypeAccesses><enabled>true</enabled><name>IB_Trust_Policy__mdt</name></customMetadataTypeAccesses>'
ps += ''.join('<fieldPermissions><editable>%s</editable><field>%s.%s</field><readable>true</readable></fieldPermissions>' % ('false' if o == 'IB_Agent_Audit_Log__c' else 'true', o, n) for o, n, t in sorted(F))
for o in objs:
    audit = o == 'IB_Agent_Audit_Log__c'
    ps += '<objectPermissions><allowCreate>true</allowCreate><allowDelete>false</allowDelete><allowEdit>%s</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>%s</object><viewAllRecords>true</viewAllRecords></objectPermissions>' % ('false' if audit else 'true', o)
ps += ''.join('<tabSettings><tab>%s</tab><visibility>Visible</visibility></tabSettings>' % o for o in objs)
w('%s/permissionsets/IB_IntentBridge_User.permissionset-meta.xml' % B, ps + '</PermissionSet>')
print(len(F), 'fields')
