# Shared File-Based ETL Setup

All file-based inventory and sales entries inherit the active shared set in
Resources > Shared ETL files. Portal sales automations retain their own extraction
profiles, passwords and OTP flow.

## Shared References

- Product List
- Store name clean-up (corrected 24 September 2026)
- National store / call-cycle master (23 September 2026)
- DC mapping and PnP status codes, where applicable
- Inventory transformed sample (17 output columns)
- Sales transformed sample (20 output columns)

The transformed samples supply only the output headers and formatting. Historical
sample rows, formulas, tables and links are never copied into a run. A separate
blank output template is not required. The prior template Resource is retained
for historical runs.

Each run snapshots the exact shared Resource generations alongside its raw file.
Replacing a master affects new runs, not completed reports or prior approvals.

## Run

Select the retail channel, customer and data type in ETLs. For an available
adapter, upload or select the raw export and choose Run ETL. No shared master
uploads or per-client assignments are needed. Review exceptions and warnings
before approving the output.

PnP defaults: source inventory as-of date, DROS x 30 estimate, unknown open PO
left blank, canonical banner column D. Advanced run overrides remain available.
Site Name comes from raw data; canonical identity remains in mapping/audit data.
Product matching uses the selected customer, not an Anchor constant. A known
other customer's article cannot be silently relabelled.

## Validated Raw Formats

- PnP Site Days Cover inventory: local replays for Anchor, Dynamic Brands and
  Penflex, with the current shared master hashes. Row and stock reconciliations
  pass; genuine source/mapping exceptions remain for review.
- Clicks daily sales: local replay for Ethica. Calendar-month aggregation retains
  measured signed units/value and does not infer tax or case conversions.

The adapter is reusable for further customers of the same format. A run must
find that customer's products in the shared Product List before producing output.

## Remaining Format Validation

All existing 24 client/channel setups inherit shared files, including entries
whose raw transformation is not enabled. Their Format validation status is not a
request to upload the masters again.

- Shoprite Group inventory: verify store/DC-file joins, weekly ROS convention,
  status rules, and duplicate/overlapping DC export handling.
- Clicks inventory: stock export alone has no four-week sell-out measure;
  confirm the required supplementary raw sales and DC inputs.
- Shoprite/Checkers sales: verify the latest-period value convention and matching
  month column. Some supplied examples use a different period or additional tax
  adjustments; these must not be guessed from headers.
- Game/Makro weekly TXT sales: define trading-month assignment for weeks spanning
  months, supplier selection, delta handling, and case/each conversion.
- Boxer and Universal Paper sales: validate period selection, client scope and
  output measures before enabling their adapters.
- Other listed channels without a validated raw sample remain unavailable.

Sharing an output layout does not make different retailers' raw formats
interchangeable. Unverified entries cannot execute PnP or Clicks rules.
