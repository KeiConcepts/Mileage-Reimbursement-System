const MONDAY_ENDPOINT = "https://api.monday.com/v2";
const PRIMARY_WORKPLACE_MONDAY_LABELS = {
  "VOX Fountain Valley": "VOX FV",
  "VOX South Coast Plaza": "VOX SCP",
  "SUP Buena Park": "SUP BP",
  "SUP Irvine": "SUP IR",
  "NEP Irvine": "NEP IR",
  "NEP Fountain Valley": "NEP FV",
  "ROL Fountain Valley": "ROL FV",
  "ROL Irvine": "ROL IR",
  Qua: "QUA",
  "Kei Coffee House": "KCH"
};

export function mondayIsConfigured(env = process.env) {
  return Boolean(env.MONDAY_API_TOKEN && env.MONDAY_BOARD_ID);
}

export function buildMondayColumnValues(request, calculation, env = process.env) {
  const profile = request.profile || {};
  const totals = calculation.totals || {};
  const period = calculation.period || {};
  const values = {};

  set(values, env.MONDAY_COL_EMPLOYEE_EMAIL, asEmail(profile.requesterEmail));
  set(values, env.MONDAY_COL_APPROVER_EMAIL, asEmail(profile.approverEmail));
  set(values, env.MONDAY_COL_PAYROLL_EMAIL, asEmail(profile.payrollEmail));
  set(values, env.MONDAY_COL_POSITION, profile.position);
  set(values, env.MONDAY_COL_PRIMARY_WORKPLACE, asLabel(getPrimaryWorkplaceMondayLabel(profile)));
  set(values, env.MONDAY_COL_SUBMISSION_DATE, asDate(new Date().toISOString().slice(0, 10)));
  set(values, env.MONDAY_COL_PERIOD_START, asDate(period.start));
  set(values, env.MONDAY_COL_PERIOD_END, asDate(period.end));
  set(values, env.MONDAY_COL_TRIP_SUMMARY, calculation.summary);
  set(values, env.MONDAY_COL_ACTUAL_MILES, totals.actualMiles);
  set(values, env.MONDAY_COL_COMMUTE_DEDUCTION, totals.commuteDeductionMiles);
  set(values, env.MONDAY_COL_REIMBURSABLE_MILES, totals.reimbursableMiles);
  set(values, env.MONDAY_COL_TRIP_DAYS, calculation.trips?.length || 0);
  set(values, env.MONDAY_COL_NOTES, request.notes);

  return values;
}

export async function submitMileageToMonday(request, calculation, env = process.env) {
  if (!mondayIsConfigured(env)) {
    throw new Error("Monday is not configured. Set MONDAY_API_TOKEN and MONDAY_BOARD_ID in .env.");
  }

  const profile = request.profile || {};
  const itemName = buildItemName(profile);
  const columnValues = buildMondayColumnValues(request, calculation, env);
  const hasGroup = Boolean(env.MONDAY_GROUP_ID);
  const mutation = hasGroup
    ? `mutation CreateMileageItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
          name
        }
      }`
    : `mutation CreateMileageItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
          name
        }
      }`;

  const variables = {
    boardId: env.MONDAY_BOARD_ID,
    itemName,
    columnValues: JSON.stringify(columnValues)
  };
  if (hasGroup) variables.groupId = env.MONDAY_GROUP_ID;

  const response = await fetch(MONDAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.MONDAY_API_TOKEN,
      ...(env.MONDAY_API_VERSION ? { "API-Version": env.MONDAY_API_VERSION } : {})
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors) {
    const detail = body.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`Monday submission failed: ${detail}`);
  }

  return body.data.create_item;
}

export function buildItemName(profile) {
  return profile.name || "Mileage request";
}

function set(values, columnId, value) {
  if (!columnId || value === null || value === undefined || value === "") return;
  values[columnId] = value;
}

function asEmail(email) {
  if (!email) return null;
  return { email, text: email };
}

function asDate(date) {
  if (!date) return null;
  return { date };
}

function asLabel(label) {
  if (!label) return null;
  return { label };
}

function getPrimaryWorkplaceMondayLabel(profile) {
  if (profile.primaryWorkplaceMondayLabel) return profile.primaryWorkplaceMondayLabel;
  return PRIMARY_WORKPLACE_MONDAY_LABELS[profile.primaryWorkplace] || profile.primaryWorkplace;
}
