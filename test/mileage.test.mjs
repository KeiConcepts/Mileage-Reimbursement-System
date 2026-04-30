import test from "node:test";
import assert from "node:assert/strict";
import { calculateMileageSubmission, DEDUCTION_POLICIES } from "../src/mileage.mjs";

const profile = {
  name: "Test Employee",
  homeAddress: "100 Home St",
  workplaceAddress: "200 Office Ave",
  primaryWorkplace: "KEI HQ",
  commuteMilesOneWay: 10
};

test("home boundary policy subtracts one-way commute for each home boundary", async () => {
  const result = await calculateMileageSubmission({
    profile,
    settings: { deductionPolicy: DEDUCTION_POLICIES.HOME_BOUNDARY },
    trips: [
      {
        id: "trip-1",
        date: "2026-04-30",
        startType: "home",
        stops: [{ label: "Client", address: "300 Client Rd" }],
        endType: "home",
        manualActualMiles: 52
      }
    ]
  });

  assert.equal(result.totals.actualMiles, 52);
  assert.equal(result.totals.commuteDeductionMiles, 20);
  assert.equal(result.totals.reimbursableMiles, 32);
});

test("field-only policy subtracts commute only when home is next to a non-office stop", async () => {
  const result = await calculateMileageSubmission({
    profile,
    settings: { deductionPolicy: DEDUCTION_POLICIES.FIELD_ONLY },
    trips: [
      {
        id: "trip-1",
        date: "2026-04-30",
        startType: "home",
        stops: [{ label: "Client", address: "300 Client Rd" }],
        endType: "office",
        manualActualMiles: 30
      },
      {
        id: "trip-2",
        date: "2026-05-01",
        startType: "home",
        stops: [],
        endType: "office",
        manualActualMiles: 10
      }
    ]
  });

  assert.equal(result.trips[0].commuteDeductionMiles, 10);
  assert.equal(result.trips[0].reimbursableMiles, 20);
  assert.equal(result.trips[1].commuteDeductionMiles, 0);
  assert.equal(result.trips[1].reimbursableMiles, 10);
});

test("round trip policy subtracts two commute legs for each home-based day", async () => {
  const result = await calculateMileageSubmission({
    profile,
    settings: { deductionPolicy: DEDUCTION_POLICIES.ROUND_TRIP_PER_DAY },
    trips: [
      {
        id: "trip-1",
        date: "2026-04-30",
        startType: "home",
        stops: [{ label: "Client", address: "300 Client Rd" }],
        endType: "office",
        manualActualMiles: 45
      }
    ]
  });

  assert.equal(result.totals.commuteDeductionMiles, 20);
  assert.equal(result.totals.reimbursableMiles, 25);
});

test("distance provider is used when manual miles are not supplied", async () => {
  const result = await calculateMileageSubmission(
    {
      profile: { ...profile, commuteMilesOneWay: "" },
      settings: { deductionPolicy: DEDUCTION_POLICIES.HOME_BOUNDARY },
      trips: [
        {
          id: "trip-1",
          date: "2026-04-30",
          startType: "home",
          stops: [{ label: "Client", address: "300 Client Rd" }],
          endType: "office"
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === "100 Home St|200 Office Ave") return 10;
      return 33;
    }
  );

  assert.equal(result.totals.actualMiles, 33);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 23);
});

test("none policy skips commute lookup", async () => {
  const result = await calculateMileageSubmission(
    {
      profile: { ...profile, commuteMilesOneWay: "" },
      settings: { deductionPolicy: DEDUCTION_POLICIES.NONE },
      trips: [
        {
          id: "trip-1",
          date: "2026-04-30",
          startType: "office",
          stops: [],
          endType: "other",
          endAddress: "300 Client Rd",
          endLabel: "Client"
        }
      ]
    },
    async (addresses) => {
      assert.deepEqual(addresses, ["200 Office Ave", "300 Client Rd"]);
      return 12;
    }
  );

  assert.equal(result.totals.actualMiles, 12);
  assert.equal(result.totals.commuteDeductionMiles, 0);
  assert.equal(result.totals.reimbursableMiles, 12);
});
