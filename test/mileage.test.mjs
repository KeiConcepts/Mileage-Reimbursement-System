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

test("home boundary policy subtracts one-way commute for home departure only", async () => {
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
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 42);
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

test("ending home is excluded from billable route and used only for trip context", async () => {
  const result = await calculateMileageSubmission(
    {
      profile: { ...profile, commuteMilesOneWay: "" },
      settings: { deductionPolicy: DEDUCTION_POLICIES.HOME_BOUNDARY },
      trips: [
        {
          id: "trip-1",
          date: "2026-05-01",
          startType: "office",
          stops: [{ label: "Client", address: "300 Client Rd" }],
          endType: "home",
          endAddress: ""
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === "100 Home St|200 Office Ave") return 10;
      assert.deepEqual(addresses, ["200 Office Ave", "300 Client Rd"]);
      return 24;
    }
  );

  assert.equal(result.trips[0].routeLabel, "KEI HQ to Client");
  assert.equal(result.totals.actualMiles, 24);
  assert.equal(result.totals.commuteDeductionMiles, 0);
  assert.equal(result.totals.reimbursableMiles, 24);
});

test("home to client to home bills home to client before commute deduction", async () => {
  const result = await calculateMileageSubmission(
    {
      profile: { ...profile, commuteMilesOneWay: "" },
      settings: { deductionPolicy: DEDUCTION_POLICIES.HOME_BOUNDARY },
      trips: [
        {
          id: "trip-1",
          date: "2026-05-01",
          startType: "home",
          stops: [{ label: "Client", address: "300 Client Rd" }],
          endType: "home"
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === "100 Home St|200 Office Ave") return 10;
      assert.deepEqual(addresses, ["100 Home St", "300 Client Rd"]);
      return 18;
    }
  );

  assert.equal(result.trips[0].routeLabel, "Home to Client");
  assert.equal(result.totals.actualMiles, 18);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 8);
});

test("example route includes home departure and subtracts normal commute once", async () => {
  const exampleProfile = {
    ...profile,
    homeAddress: "715 12th Street, Huntington Beach, CA",
    workplaceAddress: "17011 Beach Blvd Unit 676, Huntington Beach, CA 92647",
    primaryWorkplace: "KEI HQ",
    commuteMilesOneWay: ""
  };

  const result = await calculateMileageSubmission(
    {
      profile: exampleProfile,
      settings: { deductionPolicy: DEDUCTION_POLICIES.HOME_BOUNDARY },
      trips: [
        {
          id: "trip-1",
          date: "2026-05-01",
          startType: "home",
          stops: [
            { label: "Aliso Creek Road", address: "26513 Aliso Creek Road" },
            { label: "KEI HQ", address: exampleProfile.workplaceAddress },
            { label: "SUP BP", address: "5141 Beach Blvd Unit B, Buena Park, CA 90621" }
          ],
          endType: "office"
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === `${exampleProfile.homeAddress}|${exampleProfile.workplaceAddress}`) return 3;
      assert.deepEqual(addresses, [
        exampleProfile.homeAddress,
        "26513 Aliso Creek Road",
        exampleProfile.workplaceAddress,
        "5141 Beach Blvd Unit B, Buena Park, CA 90621",
        exampleProfile.workplaceAddress
      ]);
      return 74;
    }
  );

  assert.equal(result.trips[0].routeLabel, "Home to Aliso Creek Road to KEI HQ to SUP BP to KEI HQ");
  assert.equal(result.totals.actualMiles, 74);
  assert.equal(result.totals.commuteDeductionMiles, 3);
  assert.equal(result.totals.reimbursableMiles, 71);
});
