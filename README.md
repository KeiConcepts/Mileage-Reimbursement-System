# Mileage Reimbursement Tool

Next.js replacement for the Monday WorkForm mileage intake. Employees enter their home address, primary workplace, trip stops, and trip days. The app calculates actual driving miles, applies the commute deduction rule, and can create a Monday item on a separate test board.

## Current MVP

- Multi-day mileage entry
- Home, primary workplace, and custom stop routing
- Manual mileage override for testing without Google Maps
- Server-side Google Routes API calculation
- Automatic commute deduction based on Home and Primary workplace
- Server-side Monday `create_item` submission
- Browser draft saving
- Quick-address dropdowns for common workplaces and trip stops
- Next.js App Router UI and API route handlers

## Setup

1. Copy `.env.example` to `.env`.
2. Add `GOOGLE_MAPS_API_KEY` for routing, commute deduction, and address autocomplete.
3. Create your separate Monday test board.
4. Add `MONDAY_API_TOKEN`, `MONDAY_BOARD_ID`, and any column IDs you want populated.
5. Run:

```bash
npm run dev
```

Then open `http://localhost:3000`.

The app also binds to `http://127.0.0.1:3000` in local development.

Without `GOOGLE_MAPS_API_KEY`, a trip can only calculate when it does not need automatic route miles or a Home commute deduction. In normal use, set the key so the app can calculate both the actual route and the Home-to-primary-workplace deduction.

## Quick Addresses

The app currently includes these saved locations:

| Name | Address |
| --- | --- |
| KEI HQ | 17011 Beach Blvd Unit 676, Huntington Beach, CA 92647 |
| VOX Fountain Valley | 16161 Brookhurst St, Fountain Valley, CA 92708 |
| VOX South Coast Plaza | 3333 Bear St #118, Costa Mesa, CA 92626 |
| SUP Buena Park | 5141 Beach Blvd Unit B, Buena Park, CA 90621 |
| SUP Irvine | 14370 Culver Dr Unit 2H, Irvine, CA 92604 |
| NEP Irvine | 14346 Culver Dr, Irvine, CA 92604 |
| NEP Fountain Valley | 10836 Warner Ave, Fountain Valley, CA 92708 |
| ROL Fountain Valley | 16173 Brookhurst St, Fountain Valley, CA 92708 |
| ROL Irvine | 14370 Culver Dr Suite 2G, Irvine, CA 92604 |
| KIN | 16185 Brookhurst St, Fountain Valley, CA 92708 |
| Qua | 16121 Brookhurst St, Fountain Valley, CA 92708 |
| Kei Coffee House | 15691 Brookhurst St, Westminster, CA 92683 |

To add more later, update the default list in `src/serverConfig.mjs`, or set `LOCATION_PRESETS_JSON` in `.env`.

## Suggested Monday Test Board

Create one item per reimbursement request. Suggested columns:

| Column | Type | Env var |
| --- | --- | --- |
| Requester Email | Email | `MONDAY_COL_EMPLOYEE_EMAIL` |
| Approver Email | Email | `MONDAY_COL_APPROVER_EMAIL` |
| Payroll Email | Email | `MONDAY_COL_PAYROLL_EMAIL` |
| Position | Text | `MONDAY_COL_POSITION` |
| Primary Workplace | Status | `MONDAY_COL_PRIMARY_WORKPLACE` |
| Submission Date | Date | `MONDAY_COL_SUBMISSION_DATE` |
| Period Start | Date | `MONDAY_COL_PERIOD_START` |
| Period End | Date | `MONDAY_COL_PERIOD_END` |
| Trip Summary | Long Text | `MONDAY_COL_TRIP_SUMMARY` |
| Actual Miles | Numbers | `MONDAY_COL_ACTUAL_MILES` |
| Commute Deduction | Numbers | `MONDAY_COL_COMMUTE_DEDUCTION` |
| Reimbursable Miles | Numbers | `MONDAY_COL_REIMBURSABLE_MILES` |
| Trip Days | Numbers | `MONDAY_COL_TRIP_DAYS` |
| Notes | Long Text or Text | `MONDAY_COL_NOTES` |

Blank column env vars are skipped, so you can start with just a few columns and expand the board later.

## Deduction Rule

The calculator uses the Home and Primary workplace addresses to infer the commute deduction automatically:

- If a trip starts at Home, the Home-to-first-work-stop leg is included in actual miles and one normal Home-to-primary-workplace commute is deducted.
- If a trip starts at the Primary workplace, no starting commute is deducted.
- If a trip ends at Home, the last-work-stop-to-Home leg is included in actual miles and one normal primary-workplace-to-Home commute is deducted.
- If a trip starts and ends at Home, two one-way commute deductions are applied.
- Reimbursable miles never go below `0`.

## API Notes

- Monday API requests are made from Next.js route handlers so the Monday token is not exposed in the browser.
- Google Routes requests are also made from Next.js route handlers for billing and key control.
- Google Routes requests avoid toll roads by default.
- Browser autocomplete is served through the Next.js API and uses `GOOGLE_MAPS_API_KEY`.

Sources used while planning:

- Monday GraphQL overview: https://developer.monday.com/api-reference/docs/introduction-to-graphql
- Monday authentication: https://developer.monday.com/api-reference/docs/authentication
- Monday column values: https://developer.monday.com/api-reference/docs/change-column-values
- Google Routes API: https://developers.google.com/maps/documentation/routes
- Google Routes waypoints: https://developers.google.com/maps/documentation/routes/reference/rest/v2/Waypoint
- Google Place Autocomplete: https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
