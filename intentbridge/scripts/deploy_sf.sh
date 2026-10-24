#!/usr/bin/env bash
# Deploy the IntentBridge SFDX package to the org authorised under alias "intentbridge".
# Prerequisite (run once, interactively):
#   sf org login device --instance-url https://orgfarm-959056de3a-dev-ed.develop.my.salesforce.com --alias intentbridge
# Usage:  scripts/deploy_sf.sh            # deploy, assign perm set, seed data, run Apex tests
#         DRY_RUN=1 scripts/deploy_sf.sh  # validate only (check-only deploy + tests), changes nothing
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
ORG="${ORG_ALIAS:-intentbridge}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE/salesforce"
export SF_DISABLE_TELEMETRY=true SF_AUTOUPDATE_DISABLE=true

step() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }

step "Checking sf CLI and org alias '$ORG'"
sf --version
if ! sf org display --target-org "$ORG" --json >/dev/null 2>&1; then
  echo "Org alias '$ORG' is not authorised. Run:"
  echo "  sf org login device --instance-url https://orgfarm-959056de3a-dev-ed.develop.my.salesforce.com --alias $ORG"
  exit 2
fi
sf org display --target-org "$ORG" | grep -E 'Username|Instance Url|Api Version' || true

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  step "Validating (check-only deploy, runs IB_IntentBridge_Test)"
  sf project deploy validate --source-dir force-app --target-org "$ORG" \
    --test-level RunSpecifiedTests --tests IB_IntentBridge_Test --coverage-formatters text --wait 30
  exit 0
fi

step "Deploying metadata and Apex"
sf project deploy start --source-dir force-app --target-org "$ORG" --wait 30

step "Assigning permission set IB_IntentBridge_User"
sf org assign permset --name IB_IntentBridge_User --target-org "$ORG" || echo "(already assigned)"

step "Loading sample data"
sf apex run --file scripts/apex/seed.apex --target-org "$ORG" | grep -E 'USER_DEBUG|Compiled|Executed|Error' || true
sf apex run --file scripts/apex/add_me_to_queue.apex --target-org "$ORG" | grep -E 'USER_DEBUG|Executed|Error' || true

step "Running Apex tests with code coverage"
mkdir -p test-results
sf apex run test --class-names IB_IntentBridge_Test --target-org "$ORG" --code-coverage \
  --result-format human --output-dir test-results --wait 20

step "Done. Next: wire the actions in Agent Builder (see salesforce/README.md)."
echo "Open: Setup > Agentforce Agents (run: sf org open --target-org $ORG --path lightning/setup/EinsteinCopilot/home)"
