# TelForce / IntentBridge: Salesforce (SFDX) package

TelForce is the headline concept (agentic telco on the Salesforce ecosystem); IntentBridge is its governed headless layer. TelForce rows are marked **TF** below.

The Salesforce half of the IntentBridge working model. It holds the Agentforce actions and the trust pack that sit behind the in-browser demo. All TMF calls are **mocked in Apex** (`IB_TmfMockService`), so it deploys to any Developer Edition org without callouts. To go live, swap the mock methods for Named Credential callouts to MuleSoft or Agent Fabric. The action contracts stay the same.

API version 62.0. No managed packages are needed.

## What's in it

| Type | Name | Purpose |
|---|---|---|
| Custom object | `IB_Intent__c` | TMF921 intent mirror (probe, assessed, active), JSON-LD expression and report |
| Custom object | `IB_Service_Problem__c` | TMF656 service problem (postcode district, root cause, resource) |
| Custom object | `IB_Credit_Adjustment__c` | Credit requested by an agent: Applied, Pending Approval, Approved or Rejected |
| Custom object | `IB_Agent_Audit_Log__c` | SHA-256 hash-chained audit of agent and human decisions, PII masked |
| Account fields | `IB_Customer_Id__c` (ext id), `IB_Billing_Account__c`, `IB_Postcode__c`, `IB_Vulnerable__c`, `IB_SIM_Swap_Date__c`, `IB_Churn_Risk__c`, `IB_Current_Bill__c`, `IB_Previous_Bill__c`, `IB_Tenure_Months__c` | Customer context the agents read |
| Custom metadata | `IB_Trust_Policy__mdt.Default` | Auto-credit cap **£50**, discount authority 10%, SLA 99.95%, SIM-swap threshold 70 |
| Queue | `IB Supervisor` | Holds credits above the cap, for vulnerable customers, or after a recent SIM swap |
| Apex | `IB_TmfMockService` | TMF645, TMF921, TMF678, TMF656 and TMF680 shaped mock responses |
| Apex | `IB_AuditService`, `IB_TrustPolicy` | Hash chain, PII masking, chain verify; policy and SIM-swap risk |
| Invocable | **IB Check SLA Feasibility** (`IB_CheckSlaFeasibility`) | TMF921 probe and TMF645 qualification across sites (40 sites gives 37 feasible: S13, S31 and S37 fail) |
| Invocable | **IB Diagnose Bill Shock** (`IB_DiagnoseBillShock`) | Explains the increase, links the TMF656 fault, suggests a credit, flags when a human is needed |
| Invocable | **IB Propose Retention Offer** (`IB_ProposeRetentionOffer`) | Next-best offer within discount authority; consent required |
| Invocable | **IB Request Credit Adjustment** (`IB_RequestCreditAdjustment`) | ≤ £50: applied. > £50, vulnerable customer, or SIM-swap risk ≥ 70: Pending Approval in the IB Supervisor queue |
| Invocable | **IB Find Customer** (`IB_FindCustomer`) | Resolves a name, customer id or billing account to the Account Id the other actions need (used by the agent) |
| Invocable | **IB List Pending Credits** (`IB_ListPendingCredits`) | Credits waiting in the supervisor queue, with the reason each was held (used by the agent) |
| Invocable | **IB Approve or Reject Credit** (`IB_ApproveCredit`) | Supervisor decision; audited as a human action |
| Test | `IB_IntentBridge_Test` | 16 test methods, 100% coverage of every class |
| Custom object **TF** | `IB_Partner__c` | Wholesale partner agreement (TMF668): status, daily qualification limit, max order lines, unit price, **Agent Fabric kill switch** |
| Custom object **TF** | `IB_Wholesale_Order__c` | Partner order (TMF622) placed agent-to-agent: Acknowledged, Pending Partner Desk or Rejected |
| Custom object **TF** | `IB_Fallout_Order__c` | Failed order in the overnight fallout queue (TMF622) with repair path, rule and repair log |
| Custom object **TF** | `IB_Customer_Notification__c` | Proactive outage / restore message (TMF681): sms, or a human call for vulnerable customers |
| Apex **TF** | `IB_TelcoforceService` | District impact, partner checks (UNKNOWN_PARTNER, KILL_SWITCH, PARTNER_NOT_ENTITLED), approved repair playbooks, superagent intent router |
| Invocable **TF** | **IB Detect Outage Impact** | Alarm → affected customers in the district → one TMF656 service problem |
| Invocable **TF** | **IB Notify Affected** | Tells every affected customer once (duplicates refused); vulnerable customers get a queued human call |
| Invocable **TF** | **IB Restore and Credit** | No goodwill before restore (PROBLEM_NOT_RESOLVED); then goodwill through the credit trust pack (cap, vulnerable, SIM swap) |
| Invocable **TF** | **IB Partner Qualify** | A2A address qualification (TMF645) under the partner's daily limit |
| Invocable **TF** | **IB Partner Order** | A2A order within the agreement; above the line limit goes to the partner desk queue |
| Invocable **TF** | **IB Set Partner Kill Switch** | Agent Fabric kill switch on/off for one partner agent, audited |
| Invocable **TF** | **IB Repair Fallout Order** | Approved playbooks only; the Systems Integration Agent replays the recorded legacy-screen playbook; price changes and unknown errors are held for a person |
| Invocable **TF** | **IB Route Request** | Superagent router: journey, confidence, human-first, prompt-injection block, second intent |
| Test **TF** | `IB_Telcoforce_Test` | 4 test methods, 100% coverage of every TelForce class |
| Scripts **TF** | `scripts/apex/seed_telcoforce.apex`, `exercise_telcoforce_*.apex`, `reset_telcoforce.apex` | 2 more LS6 customers, 3 partners, 5 fallout orders; the org exercise; a demo reset that keeps the audit log |
| Agent | `aiAuthoringBundles/IntentBridge_Telco_Agent` | Agent Script for the **IntentBridge Telco Agent** (employee agent, 4 topics wired to the actions) |
| Permission set | `IB_IntentBridge_User` | Objects, fields, tabs, Apex classes and custom metadata |
| Scripts | `scripts/apex/seed.apex`, `scripts/apex/add_me_to_queue.apex` | Sample customers (same as the web demo) and service problems SP-7781 (LS6) and SP-7790 (M14) |

## Deploy with the sf CLI

```bash
# 1. Authorise once (OAuth device flow; opens a code to enter in the browser)
sf org login device --instance-url https://orgfarm-959056de3a-dev-ed.develop.my.salesforce.com --alias intentbridge

# 2. Optional: check-only validation with tests (changes nothing)
DRY_RUN=1 ../scripts/deploy_sf.sh

# 3. Deploy, assign the perm set, load sample data, run Apex tests with coverage
../scripts/deploy_sf.sh

# 4. Same, then exercise the TelForce actions on real records (writes org-results/telcoforce_action_outputs.txt)
EXERCISE=1 ../scripts/deploy_sf.sh      # add RESET=1 to replay from a clean demo state
```

To run the same steps by hand:

```bash
cd salesforce
sf project deploy start --source-dir force-app --target-org intentbridge --wait 30
sf org assign permset --name IB_IntentBridge_User --target-org intentbridge
sf apex run --file scripts/apex/seed.apex --target-org intentbridge
sf apex run --file scripts/apex/seed_telcoforce.apex --target-org intentbridge
sf apex run --file scripts/apex/add_me_to_queue.apex --target-org intentbridge
sf apex run test --class-names IB_IntentBridge_Test --class-names IB_Telcoforce_Test --code-coverage --result-format human --wait 20 --target-org intentbridge
```

If the org's corporate currency is not GBP, the currency fields show in that currency. The logic is currency-agnostic.

## The Agentforce agent (deployed as code)

The **IntentBridge Telco Agent** is defined in Agent Script at `force-app/main/default/aiAuthoringBundles/IntentBridge_Telco_Agent/IntentBridge_Telco_Agent.agent`. It is an *Agentforce Employee Agent* (for care advisers, account managers and supervisors), so it needs no agent user and no messaging channel. It has a router plus these subagents:

| Topic (subagent) | Actions |
|---|---|
| Bill shock and credits | IB Find Customer, IB Diagnose Bill Shock, IB Request Credit Adjustment |
| Retention offer | IB Find Customer, IB Propose Retention Offer |
| B2B SLA feasibility | IB Find Customer, IB Check SLA Feasibility |
| Credit approvals | IB List Pending Credits, IB Approve or Reject Credit (asks the user to confirm first) |
| Off topic | none (it redirects the user) |

```bash
sf agent validate authoring-bundle --api-name IntentBridge_Telco_Agent -o intentbridge
sf agent publish  authoring-bundle --api-name IntentBridge_Telco_Agent -o intentbridge
sf agent activate -n IntentBridge_Telco_Agent --version 1 -o intentbridge
./scripts/agent_preview.sh      # README test prompts, live actions; writes org-results/agent/*.jsonl
```

Record Id inputs and outputs must be declared `object` with `complex_data_type_name: "lightning__recordIdType"` or the publish step rejects them. Results from the org run are in `org-results/agent_transcripts.md`.

### Manual alternative: Agent Builder clicks

1. **Setup → Agentforce Agents → New Agent**, then pick *Agentforce Service Agent* (customer-facing) or *Agentforce Employee Agent* (Coworker, Slack). Name it **IntentBridge Telco Agent**.
2. Assign the agent's running user (for a service agent this is the *Agentforce Service Agent User*) the **IB_IntentBridge_User** permission set.
3. In **Agent Builder → Topics → New**, create the topics below. Under **This Topic's Actions → New → Create new action**, choose *Reference Action Type: Apex*. Pick the invocable by its label and tick *Require input* and *Show in conversation* as noted.

### Topic: Bill shock and credits
- **Classification description:** Customer asks why their bill went up, disputes a charge, or asks for a refund or credit.
- **Scope:** Explain bill increases and apply goodwill credits within policy. Never change price plans here.
- **Instructions:**
  1. Always start with *IB Diagnose Bill Shock* for the customer's Account. Explain the increase in plain English using its Explanation output.
  2. If *Needs human* is true (vulnerable customer or recent SIM swap), do not offer or apply credits. Tell the customer a colleague will contact them and hand off to a human.
  3. If *Suggested credit* is greater than 0, call *IB Request Credit Adjustment* with that amount, the reason, and the Service problem Id. Read back its Message exactly. Never promise a credit that came back as *Pending Approval*.
  4. Never apply more than one credit for the same service problem.
  5. Tell the customer they are talking to an AI agent and can ask for a person at any time.
- **Actions:** IB Diagnose Bill Shock, IB Request Credit Adjustment.

### Topic: Retention offer
- **Classification description:** Customer mentions leaving, cancelling, switching provider, or is unhappy after a fault.
- **Instructions:**
  1. Call *IB Propose Retention Offer*. If *Requires human* is true, hand off to a human adviser.
  2. Present one offer, explain it plainly, and ask for explicit consent ("Would you like me to add this?"). Only confirm when the customer clearly says yes.
  3. Do not invent offers or discounts that are not returned by the action.
- **Actions:** IB Propose Retention Offer.

### Topic: B2B SLA feasibility (employee agent, for account managers)
- **Classification description:** Account manager asks whether an SLA, SD-WAN, 5G slice or connectivity design is feasible for a business customer's sites.
- **Instructions:**
  1. Ask for the business Account, the number of sites (or a site list), the availability target and the latency target if they are missing.
  2. Call *IB Check SLA Feasibility*. Report how many sites are feasible and list the infeasible sites with reasons.
  3. Recommend quoting only the feasible sites and suggest an alternative for the rest. Never say an SLA is guaranteed before the intent is active.
- **Actions:** IB Check SLA Feasibility.

### Topic: Credit approvals (employee agent, for supervisors)
- **Classification description:** Supervisor asks to review, approve or reject pending credits.
- **Instructions:** List *IB Credit Adjustment Request* records with Status *Pending Approval* (or open the IB Supervisor queue list view). Confirm the record and the decision with the supervisor before calling *IB Approve or Reject Credit*.
- **Actions:** IB Approve or Reject Credit.

4. **Test in Agent Builder** using the seed data:
   - "I'm Sarah Mitchell. Why is my bill higher?" gives a £38 credit, **Applied**.
   - "I'm David Okafor, my bill jumped" gives £72.50, **Pending Approval** (IB Supervisor queue).
   - "I'm Arthur Bennett…" hands off to a human (vulnerable).
   - "Can Northwind Logistics get 99.95% and 30 ms on 40 sites?" gives 37 of 40 feasible (S13, S31 and S37 fail).
5. **Activate** the agent and add it to a channel (Messaging for Web, Slack or Coworker).
6. Audit: open the **IB Agent Audit Logs** tab. To check the chain from Anonymous Apex, run `System.debug(JSON.serialize(IB_AuditService.verify()));`.

## Org results (Developer Edition 00Dg800000OkDdxEAF, 24 Oct 2026)
See `../TEST_RESULTS.md` § "Salesforce org results". The raw outputs are in `org-results/`: `action_outputs.txt` (anonymous Apex exercise of every action via `scripts/apex/exercise_actions.apex`), `soql_after_actions.txt`, `credits_after_agent.txt` and `agent_transcripts.md`.

## TelForce org results (25 Oct 2026)
Deploy **0Afg800000IysxdCAB** (validated as 0Afg800000IybdSCAR): 20/20 Apex test methods, 100% coverage on all 19 classes. Raw outputs: `org-results/telcoforce_action_outputs.txt` and `org-results/telcoforce_apex_tests.txt`; summary in `../TEST_RESULTS.md` § 5. The agent metadata folders are in `.forceignore`: the agent is published with `sf agent` commands, and the TelForce actions are ready to add to it as new topics in Agent Builder.
