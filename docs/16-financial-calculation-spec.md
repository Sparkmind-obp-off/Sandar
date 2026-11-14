# 16 — Financial Calculation Specification

This document defines transparent arithmetic for the first Financial Relief prototype. It is not financial advice.

## Input model
A cash-flow item contains:
- direction: inflow or outflow,
- amount: non-negative decimal in a single selected currency,
- date or period,
- recurrence (none, weekly, monthly, yearly),
- status (planned, expected, confirmed, paid),
- confidence (user-defined or unknown),
- optional user label.

Do not infer amounts, recurrence, or due dates. Do not connect bank accounts in the MVP.

## Core calculations
For a selected period:
- Total inflow = sum of inflow items in the period.
- Total outflow = sum of outflow items in the period.
- Net movement = total inflow − total outflow.
- Closing estimate = opening amount + net movement.

Every displayed result must identify the selected period, included statuses, currency, and assumptions.

## Scenario behavior
- A scenario is a copy of the selected input set.
- Editing a scenario never silently edits the original plan.
- Show baseline and scenario side by side.
- Label scenario outputs as estimates, not predictions.
- Missing opening balance or uncertain dates must be shown as unknown rather than silently treated as zero.

## Validation
- Reject negative amounts; direction is a separate field.
- Use decimal-safe arithmetic; avoid binary floating-point rounding errors for currency.
- Validate dates and recurrence boundaries.
- Do not mix currencies without an explicit, sourced exchange-rate step; currency conversion is out of MVP.
- Explain rounding rules.

## Safety language
Never say that a user should skip a payment, borrow, invest, sell an asset, or disclose information. Offer neutral planning prompts and suggest checking contractual terms with the provider.

## Test cases
- Empty period: totals show zero only when the period is known to contain no items; otherwise show “no entries”.
- One inflow and one outflow: net movement equals their difference.
- Unknown opening amount: closing estimate remains unknown.
- Scenario edit: baseline remains unchanged.
- Recurring item: appears only in correctly generated periods, including month-end edge cases.
