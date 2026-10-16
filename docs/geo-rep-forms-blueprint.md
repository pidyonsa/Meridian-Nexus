# Geo Rep Forms Blueprint

Source: Geo Forms Blueprint meeting transcript, 27 July 2026, and `Form_Intake_Template.xlsx`.

## Decision

The form intake workbook is the required source of truth before a new Geo Rep form is built and before reporting starts. Geo Rep cannot reliably recover all reporting metadata after the form has been loaded.

If a completed intake is not supplied, the form is not reporting-ready and no automated report should be published for it.

## Required Form Setup

One row is required for each Geo Rep form:

- `Form Name`: exact, canonical name loaded in Geo Rep. This is the primary join key.
- `Client`
- `Start Date` and `End Date`: needed for time-gone calculations; they are not recoverable from the standard Geo reports.
- `Store List` or a durable reference to it: defines the reporting universe and denominator.
- `Form Category` and the KPI/dashboard destination.
- Requestor and request date.

The next intake version also needs banner, region, rep, and manager coverage. These should be resolved from the Meridian store/master mapping where possible, rather than typed repeatedly.

## Required Question Blueprint

One row is required for every question, in the same order as the Geo Rep form. It must include:

- Exact form name and question text.
- Question number and answer type.
- Compulsory flag.
- Question role: `Primary Measure`, `Reason / Why-Not Follow-up`, or `Supporting Detail`.
- `Linked To Question #` for follow-up or supporting questions.
- Category, sub-type, SKU/product, and any fixed target value for primary measures.
- Issue tracking key where applicable.

Follow-up and supporting questions inherit the reporting tags from their linked primary measure. This prevents a reason or photo from being classified differently from the measure it explains.

## Future Bot Flow

1. A Client Service Manager completes and submits the intake workbook before the form is built in Geo Rep.
2. Nexus validates the intake: required fields, unique exact form name, valid dates, valid linked-question references, and store/master mappings.
3. Nexus stores an approved, versioned blueprint for the form and creates the report structure from it.
4. Geo Rep extraction retrieves Form By Sheet answers and Compliance Audit Summary coverage.
5. The bot joins results using the canonical form name, question mapping, and store master.
6. The store list supplies the total universe; Form By Sheet supplies answers; Compliance Audit Summary supplies visit/not-visited coverage where needed.
7. The final report includes derived KPI calculations, time gone, issue-tracking fields, and empty values where the approved blueprint has no matching Geo data.

## Reporting Implications

- Form By Sheet is the answer-level source.
- Compliance Audit Summary can show scheduled, visited, and not-visited coverage, but does not contain the answer detail.
- Start/end dates, client, form category, and target store universe must come from the approved intake, not inferred from a downloaded Geo report.
- Exact form names and question text are contractual matching keys. A name change in Geo Rep needs a new approved intake/version.

## Rollout

Pilot with one simple form and one complex Share of Shelf/facings form, initially for Aspen. Use the results to validate the template and mapping rules before rolling the process out to other client service managers.

## No Current Change

This note records the agreed model only. No Geo Rep extractor, Store Master, or current report output has been changed from this meeting alone.
