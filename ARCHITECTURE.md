# System Architecture

## Component-Level Bidding Model

Unlike naive bidding models that quote on an entire request for proposal (RFP), this marketplace allows bidding and winning at the individual component level:

```
                  [Buyer RFQ #1001]
                  /               \
        [Component A]           [Component B]
        /           \           /           \
  [Supplier X]  [Supplier Y]  [Supplier Z]  [Supplier X]
  (Quote A)     (Quote A)     (Quote B)     (Quote B)
```

### Multi-PO Generation Flow

When the buyer selects winners per component:
1. Validations occur server-side inside an atomic Prisma `$transaction`.
2. Bids are grouped by their `supplierCompanyId`.
3. Separate `PurchaseOrder`s are created for each supplier, containing only the items they won.

```
RFQ-1001 (Component A won by Supplier X, Component B won by Supplier Z)
  ├── PO-1 (Supplier X, Component A)
  └── PO-2 (Supplier Z, Component B)
```

## Configured Strategy Defaults

1. **Quantity Splitting**: Currently locked to single winning supplier for full quantity per component.
2. **Commission Basis**: Platform commission is configured as a configurable `ruleType` and matches the selected pricing strategy (Full vs Labor only).
3. **Place of Supply**: Set to the delivery address state for Indian GST split calculation (CGST+SGST vs IGST).
