import test from "node:test";
import assert from "node:assert/strict";
import { calculateMileageSubmission } from "../src/mileage.mjs";

const profile = {
  name: "Test Employee",
  homeAddress: "100 Home St",
  workplaceAddress: "200 Office Ave",
  primaryWorkplace: "KEI HQ"
};

test("standard policy subtracts commute for home departure and home return", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
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
    },
    async (addresses) => {
      assert.deepEqual(addresses, ["100 Home St", "200 Office Ave"]);
      return 10;
    }
  );

  assert.equal(result.totals.actualMiles, 52);
  assert.equal(result.totals.commuteDeductionMiles, 20);
  assert.equal(result.totals.reimbursableMiles, 32);
});

test("distance provider is used when manual miles are not supplied", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
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

test("home to primary workplace direct commute reimburses zero miles", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
      trips: [
        {
          id: "trip-1",
          date: "2026-04-30",
          startType: "home",
          stops: [],
          endType: "office"
        }
      ]
    },
    async (addresses) => {
      assert.deepEqual(addresses, ["100 Home St", "200 Office Ave"]);
      return 10;
    }
  );

  assert.equal(result.totals.actualMiles, 10);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 0);
});

test("home to secondary work reimburses only miles over the normal commute", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
      trips: [
        {
          id: "trip-1",
          date: "2026-04-30",
          startType: "home",
          stops: [],
          endType: "other",
          endAddress: "300 Client Rd",
          endLabel: "Client"
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === "100 Home St|200 Office Ave") return 10;
      assert.deepEqual(addresses, ["100 Home St", "300 Client Rd"]);
      return 18;
    }
  );

  assert.equal(result.totals.actualMiles, 18);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 8);
});

test("office-started route does not subtract commute", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
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

test("ending home is included in actual miles and subtracts return commute", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
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
      assert.deepEqual(addresses, ["200 Office Ave", "300 Client Rd", "100 Home St"]);
      return 34;
    }
  );

  assert.equal(result.trips[0].routeLabel, "KEI HQ to Client to Home");
  assert.equal(result.totals.actualMiles, 34);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 24);
});

test("home to client to home includes both home legs and deducts normal round trip commute", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
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
      assert.deepEqual(addresses, ["100 Home St", "300 Client Rd", "100 Home St"]);
      return 36;
    }
  );

  assert.equal(result.trips[0].routeLabel, "Home to Client to Home");
  assert.equal(result.totals.actualMiles, 36);
  assert.equal(result.totals.commuteDeductionMiles, 20);
  assert.equal(result.totals.reimbursableMiles, 16);
});

test("example route includes home departure and subtracts normal commute once", async () => {
  const exampleProfile = {
    ...profile,
    homeAddress: "715 12th Street, Huntington Beach, CA",
    workplaceAddress: "17011 Beach Blvd Unit 676, Huntington Beach, CA 92647",
    primaryWorkplace: "KEI HQ"
  };

  const result = await calculateMileageSubmission(
    {
      profile: exampleProfile,
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

test("primary workplace to home direct commute reimburses zero miles", async () => {
  const result = await calculateMileageSubmission(
    {
      profile,
      trips: [
        {
          id: "trip-1",
          date: "2026-05-02",
          startType: "office",
          stops: [],
          endType: "home"
        }
      ]
    },
    async (addresses) => {
      if (addresses.join("|") === "100 Home St|200 Office Ave") return 10;
      assert.deepEqual(addresses, ["200 Office Ave", "100 Home St"]);
      return 10;
    }
  );

  assert.equal(result.totals.actualMiles, 10);
  assert.equal(result.totals.commuteDeductionMiles, 10);
  assert.equal(result.totals.reimbursableMiles, 0);
});

test("home boundary trips require a primary workplace address for the commute deduction", async () => {
  await assert.rejects(
    calculateMileageSubmission(
      {
        profile: { ...profile, workplaceAddress: "" },
        trips: [
          {
            id: "trip-1",
            date: "2026-05-02",
            startType: "home",
            stops: [{ label: "Client", address: "300 Client Rd" }],
            endType: "other",
            endAddress: "300 Client Rd",
            manualActualMiles: 22
          }
        ]
      },
      async () => 10
    ),
    /Home and Primary workplace addresses are required/
  );
});

test("manual actual miles still require Google Routes when a home commute deduction is needed", async () => {
  await assert.rejects(
    calculateMileageSubmission({
      profile,
      trips: [
        {
          id: "trip-1",
          date: "2026-05-02",
          startType: "home",
          stops: [{ label: "Client", address: "300 Client Rd" }],
          endType: "office",
          manualActualMiles: 22
        }
      ]
    }),
    /Automatic commute deduction needs GOOGLE_MAPS_API_KEY/
  );
});
