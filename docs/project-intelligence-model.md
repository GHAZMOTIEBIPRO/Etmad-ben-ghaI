# Saudi Projects Intelligence Model

## Product goal

The radar is not a tender directory. It is a project-intelligence system that connects public signals into a lifecycle:

`source signal -> unified project -> stage -> parties -> opportunity -> award -> market analysis`

## Core entities

### Project
A real or probable project/program/package identified from one or more public sources.

Key fields:
- name
- owner/entity
- region
- sector/activity
- stage
- estimated value
- award value
- first/last seen
- confidence score
- Ben Ghazi fit score

### Project source
Every project keeps evidence links. Source truth is never discarded when records are merged.

### Project party
Current roles supported:
- owner/entity
- contractor/winner
- supplier

Future roles:
- developer
- consultant
- designer
- PMC
- operator

### Project opportunity
A tender, EOI, RFQ, RFP, investment opportunity, contracting opportunity, or procurement-plan item linked to the wider project.

### Project event
Designed for future stage transitions and timeline intelligence:
- discovered
- design announced
- EOI/RFQ/RFP launched
- tender opened
- award announced
- construction started
- completed/on hold/cancelled

## Lifecycle stages

1. Planning
2. Design
3. Qualification
4. Tendering
5. Awarded
6. Construction
7. Operation & Maintenance
8. Completed

Exceptional states: On hold, Cancelled.

## Current grouping strategy

The first production version uses deterministic entity resolution based on:
- normalized opportunity/project name
- owner/entity
- region

It deliberately prefers precision over aggressive merging. Multi-source fuzzy entity resolution should be introduced only after storing enough labeled examples to measure false merges.

## Confidence

Confidence increases when a project has:
- multiple independent source URLs
- multiple linked opportunities/events
- an official estimated value

Confidence is not a truth guarantee. It is a ranking signal for data completeness.

## Market dashboard principles

The market page should answer in under two minutes:
- How many projects are visible?
- What is the known value?
- What is in the pipeline?
- Which stages are growing?
- Which regions and sectors are most active?
- What changed recently?
- Which projects best fit the target contractor?

## Free-data-first policy

The system prioritizes public and free sources. Paid APIs and subscription databases are not required for the core product.

High-value public layers include:
- PIF Private Sector Hub opportunities
- NCP PPP project stages and announcements
- SWPC future project pipeline
- FURAS investment opportunities
- Muqawil projects and contractor market
- government procurement-plan pages/files
- Balady open data
- Saudi Open Data
- Riyadh Municipality open data
- GASTAT construction and price indicators

## Data quality rules

- Never invent a value, deadline, party, or stage that is not present or reasonably inferable from a source signal.
- Keep source URLs after merging.
- Mark inferred stages as model output, not source truth.
- Do not treat open-data market datasets as tenders.
- Do not silently delete records when a parser returns zero.
- Prefer stale-but-last-known data with a freshness warning over destructive empty syncs.
