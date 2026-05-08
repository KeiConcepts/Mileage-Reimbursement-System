const METERS_PER_MILE = 1609.344;

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
  const trips = Array.isArray(input.trips) ? input.trips : [];
  const calculatedTrips = [];
  const warnings = [];

  for (const trip of trips) {
    const calculated = await calculateTrip(trip, profile, distanceProvider);
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

  const period = getPeriodBounds(calculatedTrips);

  return {
    trips: calculatedTrips,
    totals: roundedTotals,
    period,
    warnings: [...new Set(warnings)],
    summary: createSubmissionSummary(profile, calculatedTrips, roundedTotals)
  };
}

export async function calculateTrip(trip, profile, distanceProvider) {
  const warnings = [];
  const routePoints = buildRoutePoints(trip, profile);
  const actualRoutePoints = routePoints;
  const routeLabel = actualRoutePoints.map((point) => point.label).join(" to ");
  const manualActualMiles = readMiles(trip.manualActualMiles);
  const actualMiles =
    manualActualMiles !== null
      ? manualActualMiles
      : await getDistanceMiles(actualRoutePoints, distanceProvider, `actual route for ${trip.date || "trip"}`);

  if (manualActualMiles !== null) {
    warnings.push(`Used manually entered actual miles for ${trip.date || "one trip"}.`);
  }

  const commuteMiles = shouldCalculateCommute(routePoints) ? await getCommuteMiles(profile, distanceProvider) : 0;
  const commuteDeductionMiles = getCommuteDeductionMiles(routePoints, commuteMiles);
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
    actualRoutePoints,
    actualMiles: roundMiles(actualMiles),
    commuteMiles: roundMiles(commuteMiles),
    commuteDeductionMiles: roundMiles(commuteDeductionMiles),
    reimbursableMiles: roundMiles(reimbursableMiles),
    warnings
  };
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

export async function getCommuteMiles(profile, distanceProvider) {
  if (!profile.homeAddress || !profile.workplaceAddress) {
    throw new Error("Home and Primary workplace addresses are required for the commute deduction.");
  }

  if (!distanceProvider) {
    throw new Error("Automatic commute deduction needs GOOGLE_MAPS_API_KEY because this trip starts or ends at Home.");
  }

  return distanceProvider([profile.homeAddress, profile.workplaceAddress]);
}

export function shouldCalculateCommute(routePoints) {
  return routePoints[0]?.kind === "home" || routePoints[routePoints.length - 1]?.kind === "home";
}

export function getCommuteDeductionMiles(routePoints, commuteMiles) {
  if (!commuteMiles) return 0;
  const startsAtHome = routePoints[0]?.kind === "home";
  const endsAtHome = routePoints[routePoints.length - 1]?.kind === "home";
  return (startsAtHome ? commuteMiles : 0) + (endsAtHome ? commuteMiles : 0);
}
