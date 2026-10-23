"""In-memory mock TM Forum Open API resources.

Each class mimics the resource shape and the key operations of the named TMF API.
They are deliberately small: enough to drive realistic agent behaviour in tests.

  TMF629 Customer Management        -> CustomerAPI
  TMF637 Product Inventory          -> ProductInventoryAPI
  TMF678 Customer Bill Management   -> CustomerBillAPI (+ adjustment, as a TMF666/678-style credit)
  TMF621 Trouble Ticket             -> TroubleTicketAPI
  TMF641 Service Ordering           -> ServiceOrderAPI
  TMF642 Alarm Management           -> AlarmAPI
  TMF620 Product Catalogue          -> ProductCatalogAPI (retention offers)
"""
from __future__ import annotations

import copy
import itertools
from dataclasses import dataclass, field
from typing import Any


class NotFound(Exception):
    pass


def _ids(prefix: str):
    c = itertools.count(1)
    return lambda: f"{prefix}-{next(c):05d}"


@dataclass
class CustomerAPI:  # TMF629
    customers: dict[str, dict[str, Any]] = field(default_factory=dict)

    def retrieve(self, customer_id: str) -> dict[str, Any]:
        if customer_id not in self.customers:
            raise NotFound(customer_id)
        return copy.deepcopy(self.customers[customer_id])

    def patch(self, customer_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        self.customers[customer_id].update(changes)
        return self.retrieve(customer_id)


@dataclass
class ProductInventoryAPI:  # TMF637
    products: list[dict[str, Any]] = field(default_factory=list)

    def list_for_customer(self, customer_id: str) -> list[dict[str, Any]]:
        return [copy.deepcopy(p) for p in self.products if p["relatedParty"] == customer_id]


@dataclass
class CustomerBillAPI:  # TMF678
    bills: dict[str, dict[str, Any]] = field(default_factory=dict)
    adjustments: list[dict[str, Any]] = field(default_factory=list)
    _next: Any = field(default_factory=lambda: _ids("ADJ"))

    def retrieve(self, bill_id: str) -> dict[str, Any]:
        if bill_id not in self.bills:
            raise NotFound(bill_id)
        return copy.deepcopy(self.bills[bill_id])

    def latest_for_customer(self, customer_id: str) -> dict[str, Any]:
        bills = [b for b in self.bills.values() if b["relatedParty"] == customer_id]
        if not bills:
            raise NotFound(customer_id)
        return copy.deepcopy(sorted(bills, key=lambda b: b["billDate"])[-1])

    def create_adjustment(self, bill_id: str, amount: float, reason: str) -> dict[str, Any]:
        adj = {"id": self._next(), "billId": bill_id, "amount": {"unit": "GBP", "value": -abs(amount)},
               "reason": reason, "state": "applied"}
        self.adjustments.append(adj)
        return adj


@dataclass
class TroubleTicketAPI:  # TMF621
    tickets: dict[str, dict[str, Any]] = field(default_factory=dict)
    _next: Any = field(default_factory=lambda: _ids("TT"))

    def create(self, **body: Any) -> dict[str, Any]:
        tid = self._next()
        t = {"id": tid, "status": "acknowledged", **body}
        self.tickets[tid] = t
        return copy.deepcopy(t)

    def find_open_parent(self, postcode_district: str) -> dict[str, Any] | None:
        for t in self.tickets.values():
            if t.get("ticketType") == "networkIncident" and t.get("area") == postcode_district \
                    and t["status"] != "resolved":
                return copy.deepcopy(t)
        return None


@dataclass
class ServiceOrderAPI:  # TMF641
    orders: dict[str, dict[str, Any]] = field(default_factory=dict)

    def retrieve(self, order_id: str) -> dict[str, Any]:
        if order_id not in self.orders:
            raise NotFound(order_id)
        return copy.deepcopy(self.orders[order_id])

    def patch(self, order_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        self.orders[order_id].update(changes)
        return self.retrieve(order_id)


@dataclass
class AlarmAPI:  # TMF642
    alarms: list[dict[str, Any]] = field(default_factory=list)

    def active_for_area(self, postcode_district: str) -> list[dict[str, Any]]:
        return [copy.deepcopy(a) for a in self.alarms
                if a["area"] == postcode_district and a["state"] == "raised"]


@dataclass
class ProductCatalogAPI:  # TMF620
    offerings: list[dict[str, Any]] = field(default_factory=list)

    def retention_offers(self, segment: str) -> list[dict[str, Any]]:
        return [copy.deepcopy(o) for o in self.offerings
                if o["category"] == "retention" and segment in o["eligibleSegments"]]


@dataclass
class BSSOSS:
    """Bundle of all mocked BSS/OSS endpoints (what MuleSoft would front in production)."""
    customer: CustomerAPI
    inventory: ProductInventoryAPI
    bill: CustomerBillAPI
    ticket: TroubleTicketAPI
    service_order: ServiceOrderAPI
    alarm: AlarmAPI
    catalog: ProductCatalogAPI


def seed() -> BSSOSS:
    """Deterministic seed data for a fictional UK CSP."""
    customers = {
        "CUST-1001": {"id": "CUST-1001", "name": "Alex Morgan", "segment": "consumer",
                      "postcode": "LS1 4AP", "email": "alex.morgan@example.co.uk",
                      "msisdn": "07700900111", "tenureMonths": 48, "vulnerable": False,
                      "riskSignals": []},
        "CUST-1002": {"id": "CUST-1002", "name": "Priya Shah", "segment": "consumer",
                      "postcode": "M1 2AB", "email": "priya.shah@example.co.uk",
                      "msisdn": "07700900222", "tenureMonths": 7, "vulnerable": True,
                      "riskSignals": ["password_reset_24h", "new_device_login", "port_out_query"]},
        "CUST-1003": {"id": "CUST-1003", "name": "Sam Okafor", "segment": "consumer",
                      "postcode": "G2 1DY", "email": "sam.okafor@example.co.uk",
                      "msisdn": "07700900444", "tenureMonths": 26, "vulnerable": False,
                      "riskSignals": []},
        "CUST-2001": {"id": "CUST-2001", "name": "Northwind Logistics Ltd", "segment": "smb",
                      "postcode": "BS1 5TR", "email": "it@northwind.example.co.uk",
                      "msisdn": "07700900333", "tenureMonths": 30, "vulnerable": False,
                      "riskSignals": []},
    }
    products = [
        {"id": "PI-1", "relatedParty": "CUST-1001", "name": "Full Fibre 500", "status": "active",
         "serviceId": "SVC-FTTP-1001"},
        {"id": "PI-2", "relatedParty": "CUST-1001", "name": "SIM-only 30GB", "status": "active",
         "serviceId": "SVC-MOB-1001"},
        {"id": "PI-3", "relatedParty": "CUST-1002", "name": "5G Unlimited", "status": "active",
         "serviceId": "SVC-MOB-1002"},
        {"id": "PI-5", "relatedParty": "CUST-1003", "name": "5G Unlimited", "status": "active",
         "serviceId": "SVC-MOB-1003"},
        {"id": "PI-4", "relatedParty": "CUST-2001", "name": "Business Fibre 900", "status": "pendingActive",
         "serviceId": "SVC-FTTP-2001"},
    ]
    bills = {
        "BILL-1001-09": {"id": "BILL-1001-09", "relatedParty": "CUST-1001", "billDate": "2026-09-30",
                         "amountDue": 96.40,
                         "lines": [{"type": "recurring", "desc": "Full Fibre 500", "amount": 39.00},
                                   {"type": "recurring", "desc": "SIM-only 30GB", "amount": 18.00},
                                   {"type": "roaming", "desc": "EU roaming - France (passport not applied)",
                                    "amount": 39.40, "plan_includes_roaming": True}]},
        "BILL-1003-09": {"id": "BILL-1003-09", "relatedParty": "CUST-1003", "billDate": "2026-09-30",
                         "amountDue": 102.50,
                         "lines": [{"type": "recurring", "desc": "5G Unlimited", "amount": 30.00},
                                   {"type": "roaming", "desc": "EU roaming - Spain (passport not applied)",
                                    "amount": 72.50, "plan_includes_roaming": True}]},
        "BILL-2001-09": {"id": "BILL-2001-09", "relatedParty": "CUST-2001", "billDate": "2026-09-30",
                         "amountDue": 412.00,
                         "lines": [{"type": "one-off", "desc": "Early termination charge (disputed)",
                                    "amount": 240.00},
                                   {"type": "recurring", "desc": "Business Fibre 900", "amount": 172.00}]},
    }
    service_orders = {
        "SO-77001": {"id": "SO-77001", "relatedParty": "CUST-2001", "state": "held",
                     "serviceSpecification": "FTTP-900", "falloutCode": "ADDR_UPRN_MISMATCH",
                     "installAddress": {"uprn": "100012345678", "postcode": "BS1 5TR"},
                     "addressMaster": {"uprn": "100012345679", "postcode": "BS1 5TR"},
                     "retries": 0},
        "SO-77002": {"id": "SO-77002", "relatedParty": "CUST-2001", "state": "held",
                     "serviceSpecification": "SIP-TRUNK", "falloutCode": "OLO_REJECT_UNKNOWN",
                     "retries": 2},
    }
    alarms = [{"id": "AL-501", "area": "LS1", "state": "raised", "severity": "major",
               "probableCause": "fibre cable cut (third-party damage)", "etr": "2026-10-24T14:00Z"}]
    tickets = TroubleTicketAPI()
    tickets.create(ticketType="networkIncident", area="LS1", severity="major",
                   description="Fibre cable cut - LS1 cabinet 12", relatedAlarm="AL-501")
    offerings = [
        {"id": "PO-RET-1", "name": "Loyalty: 6 months at 20% off", "category": "retention",
         "eligibleSegments": ["consumer"], "monthlyDiscountGBP": 7.80, "maxTenureMonths": None},
        {"id": "PO-RET-2", "name": "Free speed boost to Full Fibre 900", "category": "retention",
         "eligibleSegments": ["consumer", "smb"], "monthlyDiscountGBP": 0.0, "maxTenureMonths": None},
    ]
    return BSSOSS(
        customer=CustomerAPI(customers), inventory=ProductInventoryAPI(products),
        bill=CustomerBillAPI(bills), ticket=tickets, service_order=ServiceOrderAPI(service_orders),
        alarm=AlarmAPI(alarms), catalog=ProductCatalogAPI(offerings),
    )
