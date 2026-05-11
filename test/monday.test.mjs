import test from "node:test";
import assert from "node:assert/strict";
import { buildItemName, buildMondayColumnValues } from "../src/monday.mjs";

test("monday column values map primary workplace as a status label and do not set status", () => {
  const values = buildMondayColumnValues(
    {
      profile: {
        requesterEmail: "employee@example.com",
        primaryWorkplace: "VOX Fountain Valley",
        primaryWorkplaceMondayLabel: "VOX FV"
      },
      notes: "Receipt attached."
    },
    {
      period: { start: "2026-05-01" },
      summary: "Trip summary",
      totals: {
        actualMiles: 42,
        commuteDeductionMiles: 6,
        reimbursableMiles: 36
      },
      trips: [{ id: "trip-1" }]
    },
    {
      MONDAY_COL_EMPLOYEE_EMAIL: "email",
      MONDAY_COL_PRIMARY_WORKPLACE: "location",
      MONDAY_COL_STATUS: "status",
      MONDAY_STATUS_LABEL: "Submitted",
      MONDAY_COL_NOTES: "notes"
    }
  );

  assert.deepEqual(values.location, { label: "VOX FV" });
  assert.deepEqual(values.email, { email: "employee@example.com", text: "employee@example.com" });
  assert.equal(values.notes, "Receipt attached.");
  assert.equal(values.status, undefined);
});

test("monday column values fall back to renamed primary workplace labels", () => {
  const values = buildMondayColumnValues(
    {
      profile: {
        primaryWorkplace: "SUP Irvine"
      }
    },
    {
      period: {},
      summary: "",
      totals: {},
      trips: []
    },
    {
      MONDAY_COL_PRIMARY_WORKPLACE: "location"
    }
  );

  assert.deepEqual(values.location, { label: "SUP IR" });
});

test("monday item name uses only the employee name", () => {
  assert.equal(buildItemName({ name: "Ethan Le" }), "Ethan Le");
  assert.equal(buildItemName({}), "Mileage request");
});
