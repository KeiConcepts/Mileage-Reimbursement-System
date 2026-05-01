const METERS_PER_MILE = 1609.344;

export const DEDUCTION_POLICIES = {
  HOME_BOUNDARY: "home_boundary",
  ROUND_TRIP_PER_DAY: "round_trip_per_day",
  FIELD_ONLY: "field_only",
  NONE: "none"
};

export function metersToMiles(meters) {
  return Number(meters) / METERS_PER_MILE;
}

export function roundMiles(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 10) / 10;
}

export function readMiles(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function createSubmissionSummary(profile, trips, totals) {
  const lines = [];
  lines.push(`Employee: ${profile.name || "Unknown"}`);
  lines.push(`Primary workplace: ${profile.primaryWorkplace || "Not selected"}`);
  lines.push(`Actual miles: ${totals.actualMiles.toFixed(1)}`);
  lines.push(`Commute deduction: ${totals.commuteDeductionMiles.toFixed(1)}`);
  lines.push(`Reimbursable miles: ${totals.reimbursableMiles.toFixed(1)}`);
  lines.push("");
  lines.push("Trip days:");

  for (const trip of trips) {
    lines.push(
      `${trip.date || "No date"} - ${trip.routeLabel}: actual ${trip.actualMiles.toFixed(1)}, deduction ${trip.commuteDeductionMiles.toFixed(1)}, reimbursable ${trip.reimbursableMiles.toFixed(1)}`
    );
    if (trip.notes) lines.push(`Notes: ${trip.notes}`);
  }

  return lines.join("\n");
}

export function getPeriodBounds(trips) {
  const dates = trips.map((trip) => trip.date).filter(Boolean).sort();
  return {
    start: dates[0] || "",
    end: dates[dates.length - 1] || ""
  };
}

export async function calculateMileageSubmission(input, distanceProvider) {
  const profile = input.profile || {};
  const settings = input.settings || {};
  const trips = Array.isArray(input.trips) ? input.trips : [];
  const calculatedTrips = [];
  const warnings = [];

  for (const trip of trips) {
    const calculated = await calculateTrip(trip, profile, settings, distanceProvider);
    calculatedTrips.push(calculated);
    warnings.push(...calculated.warnings);
  }

  const totals = calculatedTrips.reduce(
    (sum, trip) => ({
      actualMiles: sum.actualMiles + trip.actualMiles,
      commuteDeductionMiles: sum.commuteDeductionMiles + trip.commuteDeductionMiles,
      reimbursableMiles: sum.reimbursableMiles + trip.reimbursableMiles
    }),
    { actualMiles: 0, commuteDeductionMiles: 0, reimbursableMiles: 0 }
  );

  const roundedTotals = {
    actualMiles: roundMiles(totals.actualMiles),
    commuteDeductionMiles: roundMiles(totals.commuteDeductionMiles),
    reimbursableMiles: roundMiles(totals.reimbursableMiles)
  };

  const reimbursementRate = readMiles(profile.reimbursementRate);
  const reimbursementAmount =
    reimbursementRate === null ? null : Math.round(roundedTotals.reimbursableMiles * reimbursementRate * 100) / 100;
  const period = getPeriodBounds(calculatedTrips);

  return {
    trips: calculatedTrips,
    totals: {
      ...roundedTotals,
      reimbursementAmount
    },
    period,
    warnings: [...new Set(warnings)],
    summary: createSubmissionSummary(profile, calculatedTrips, roundedTotals)
  };
}

export async function calculateTrip(trip, profile, settings, distanceProvider) {
  const warnings = [];
  const routePoints = buildRoutePoints(trip, profile);
  const billableRoutePoints = buildBillableRoutePoints(routePoints);
  const routeLabel = billableRoutePoints.map((point) => point.label).join(" to ");
  const manualActualMiles = readMiles(trip.manualActualMiles);
  const actualMiles =
    manualActualMiles !== null
      ? manualActualMiles
      : await getDistanceMiles(billableRoutePoints, distanceProvider, `actual route for ${trip.date || "trip"}`);

  if (manualActualMiles !== null) {
    warnings.push(`Used manually entered actual miles for ${trip.date || "one trip"}.`);
  }

  const commuteMiles = shouldCalculateCommute(routePoints, settings.deductionPolicy)
    ? await getCommuteMiles(profile, distanceProvider, warnings)
    : 0;
  const commuteDeductionMiles = getCommuteDeductionMiles(trip, routePoints, commuteMiles, settings.deductionPolicy);
  const reimbursableMiles = Math.max(0, actualMiles - commuteDeductionMiles);

  if (commuteDeductionMiles > actualMiles) {
    warnings.push(`Deduction exceeded actual miles for ${trip.date || "one trip"}; reimbursable miles were set to 0.`);
  }

  return {
    id: trip.id,
    date: trip.date || "",
    notes: trip.notes || "",
    routeLabel,
    routePoints,
    billableRoutePoints,
    actualMiles: roundMiles(actualMiles),
    commuteMiles: roundMiles(commuteMiles),
    commuteDeductionMiles: roundMiles(commuteDeductionMiles),
    reimbursableMiles: roundMiles(reimbursableMiles),
    warnings
  };
}

export function buildBillableRoutePoints(routePoints) {
  if (routePoints.length > 1 && routePoints[routePoints.length - 1]?.kind === "home") {
    return routePoints.slice(0, -1);
  }

  return routePoints;
}

export function buildRoutePoints(trip, profile) {
  const points = [];
  points.push(resolveEndpoint(trip.startType, trip.startAddress, trip.startLabel, profile));

  for (const stop of trip.stops || []) {
    if (stop.address || stop.label) {
      points.push({
        kind: "business",
        label: stop.label || stop.address || "Work location",
        address: stop.address || ""
      });
    }
  }

  points.push(resolveEndpoint(trip.endType, trip.endAddress, trip.endLabel, profile));
  return points;
}

export function resolveEndpoint(type, address, label, profile) {
  if (type === "home") {
    return {
      kind: "home",
      label: "Home",
      address: profile.homeAddress || ""
    };
  }

  if (type === "office") {
    return {
      kind: "office",
      label: profile.primaryWorkplace || "Primary workplace",
      address: profile.workplaceAddress || ""
    };
  }

  return {
    kind: "business",
    label: label || address || "Other location",
    address: address || ""
  };
}

export async function getDistanceMiles(points, distanceProvider, label) {
  if (points.length < 2) return 0;
  if (!distanceProvider) {
    throw new Error(
      `Automatic route mileage is not configured for ${label}. Add GOOGLE_MAPS_API_KEY to .env, or enter an Actual miles override for this trip day.`
    );
  }

  const addresses = points.map((point) => point.address);
  if (addresses.some((address) => !address) || addresses.length < 2) {
    throw new Error(`At least two addresses are required for ${label}.`);
  }

  return distanceProvider(addresses);
}

export async function getCommuteMiles(profile, distanceProvider, warnings) {
  const manualCommuteMiles = readMiles(profile.commuteMilesOneWay);
  if (manualCommuteMiles !== null) {
    warnings.push("Used manually entered one-way commute miles.");
    return manualCommuteMiles;
  }

  if (!profile.homeAddress || !profile.workplaceAddress) {
    warnings.push("Home or workplace address is missing; commute deduction used 0 miles.");
    return 0;
  }

  if (!distanceProvider) {
    warnings.push("Google Routes is not configured; commute deduction used 0 miles.");
    return 0;
  }

  return distanceProvider([profile.homeAddress, profile.workplaceAddress]);
}

export function shouldCalculateCommute(routePoints, policy = DEDUCTION_POLICIES.HOME_BOUNDARY) {
  if (policy === DEDUCTION_POLICIES.NONE) return false;
  const startsAtHome = routePoints[0]?.kind === "home";
  const endsAtHome = routePoints[routePoints.length - 1]?.kind === "home";
  if (policy === DEDUCTION_POLICIES.ROUND_TRIP_PER_DAY) return startsAtHome || endsAtHome;
  return startsAtHome || endsAtHome;
}

export function getCommuteDeductionMiles(trip, routePoints, commuteMiles, policy = DEDUCTION_POLICIES.HOME_BOUNDARY) {
  if (!commuteMiles || policy === DEDUCTION_POLICIES.NONE) return 0;

  const startsAtHome = routePoints[0]?.kind === "home";
  const endsAtHome = routePoints[routePoints.length - 1]?.kind === "home";
  const firstStop = routePoints[1];
  const previousStop = routePoints[routePoints.length - 2];

  if (policy === DEDUCTION_POLICIES.ROUND_TRIP_PER_DAY) {
    return startsAtHome || endsAtHome ? commuteMiles * 2 : 0;
  }

  if (policy === DEDUCTION_POLICIES.FIELD_ONLY) {
    const morningFieldDeparture = startsAtHome && firstStop && firstStop.kind !== "office";
    const eveningFieldReturn = endsAtHome && previousStop && previousStop.kind !== "office";
    return (morningFieldDeparture ? commuteMiles : 0) + (eveningFieldReturn ? commuteMiles : 0);
  }

  return startsAtHome ? commuteMiles : 0;
}
