from telco_agentic.reasoner import LLMReasoner, RuleBasedReasoner


def test_rule_based_primary_and_secondary():
    r = RuleBasedReasoner()
    assert r.classify("Wrong roaming charge on my bill, I'll leave") == ["billing_dispute", "churn_risk"]
    assert r.classify("broadband down again") == ["network_fault"]
    assert r.classify("please swap my SIM") == ["sim_swap"]
    assert r.classify("what's the weather") == []


def test_llm_reasoner_valid_output_used():
    r = LLMReasoner(lambda prompt: '["network_fault"]')
    assert r.classify("anything") == ["network_fault"]


def test_llm_reasoner_hallucinated_intent_falls_back():
    r = LLMReasoner(lambda prompt: '["issue_free_iphone"]')
    assert r.classify("my bill is wrong") == ["billing_dispute"]


def test_llm_reasoner_exception_falls_back():
    def boom(_):
        raise RuntimeError("model unavailable")
    assert LLMReasoner(boom).classify("no internet") == ["network_fault"]
