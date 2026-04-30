# Mileage Reimbursement Tool

Custom replacement for the Monday WorkForm mileage intake. Employees enter their home address, primary workplace, trip stops, and trip days. The app calculates actual driving miles, applies the commute deduction rule, and can create a Monday item on a separate test board.

## Current MVP

- Multi-day mileage entry
- Home, primary workplace, and custom stop routing
- Manual mileage override for testing without Google Maps
- Server-side Google Routes API calculation
- Configurable commute deduction policy
- Server-side Monday `create_item` submission
- Browser draft saving
- Quick-address dropdowns for common workplaces and trip stops

## Setup

1. Copy `.env.example` to `.env`.
2. Add `GOOGLE_MAPS_API_KEY` when you want automatic routing.
3. Add `GOOGLE_MAPS_BROWSER_KEY` when you want address autocomplete.
4. Create your separate Monday test board.
5. Add `MONDAY_API_TOKEN`, `MONDAY_BOARD_ID`, and any column IDs you want populated.
6. Run:

```bash
npm run dev
```

Then open `http://localhost:3000`.

Without `GOOGLE_MAPS_API_KEY`, the app runs in manual mode: each trip day needs an Actual miles override. Once the key is set, the same form calculates route miles from the entered addresses.

## Quick Addresses

The app currently includes these saved locations:

| Name | Address |
| --- | --- |
| KEI HQ | 17011 Beach Blvd Unit 676, Huntington Beach, CA 92647 |
| VOX FV | 16161 Brookhurst St, Fountain Valley, CA 92708 |
| VOX SCP | 3333 Bear St #118, Costa Mesa, CA 92626 |
| SUP BP | 5141 Beach Blvd Unit B, Buena Park, CA 90621 |
| SUP IR | 14370 Culver Dr Unit 2H, Irvine, CA 92604 |

To add more later, update the default list in `server.mjs`, or set `LOCATION_PRESETS_JSON` in `.env`.

## Suggested Monday Test Board

Create one item per reimbursement request. Suggested columns:

| Column | Type | Env var |
| --- | --- | --- |
| Requester Email | Email | `MONDAY_COL_EMPLOYEE_EMAIL` |
| Approver Email | Email | `MONDAY_COL_APPROVER_EMAIL` |
| Payroll Email | Email | `MONDAY_COL_PAYROLL_EMAIL` |
| Position | Text | `MONDAY_COL_POSITION` |
| Primary Workplace | Text or Status | `MONDAY_COL_PRIMARY_WORKPLACE` |
| Submission Date | Date | `MONDAY_COL_SUBMISSION_DATE` |
| Period Start | Date | `MONDAY_COL_PERIOD_START` |
| Period End | Date | `MONDAY_COL_PERIOD_END` |
| Trip Summary | Long Text | `MONDAY_COL_TRIP_SUMMARY` |
| Actual Miles | Numbers | `MONDAY_COL_ACTUAL_MILES` |
| Commute Deduction | Numbers | `MONDAY_COL_COMMUTE_DEDUCTION` |
| Reimbursable Miles | Numbers | `MONDAY_COL_REIMBURSABLE_MILES` |
| Trip Days | Numbers | `MONDAY_COL_TRIP_DAYS` |
| Reimbursement Amount | Numbers | `MONDAY_COL_REIMBURSEMENT_AMOUNT` |
| Notes | Long Text or Text | `MONDAY_COL_NOTES` |
| Status | Status | `MONDAY_COL_STATUS` |

Blank column env vars are skipped, so you can start with just a few columns and expand the board later.

## Deduction Rules

- `home_boundary`: subtract one one-way commute when a trip starts at home and one when it ends at home.
- `round_trip_per_day`: subtract two one-way commutes for each home-based trip day.
- `field_only`: subtract one-way commute only when home is next to a non-office stop.
- `none`: do not subtract commute miles.

## API Notes

- Monday API requests are made from the Node server so the Monday token is not exposed in the browser.
- Google Routes requests are also made from the Node server for billing and key control.
- Browser autocomplete is optional and uses `GOOGLE_MAPS_BROWSER_KEY`.

Sources used while planning:

- Monday GraphQL overview: https://developer.monday.com/api-reference/docs/introduction-to-graphql
- Monday authentication: https://developer.monday.com/api-reference/docs/authentication
- Monday column values: https://developer.monday.com/api-reference/docs/change-column-values
- Google Routes API: https://developers.google.com/maps/documentation/routes
- Google Routes waypoints: https://developers.google.com/maps/documentation/routes/reference/rest/v2/Waypoint
- Google Place Autocomplete: https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
