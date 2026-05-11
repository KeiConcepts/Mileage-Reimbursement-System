import test from "node:test";
import assert from "node:assert/strict";
import { getLocationPresets } from "../src/serverConfig.mjs";

test("default location presets include renamed and added workplaces", () => {
  const previousOverride = process.env.LOCATION_PRESETS_JSON;
  delete process.env.LOCATION_PRESETS_JSON;

  try {
    const presets = getLocationPresets();
    const byName = new Map(presets.map((preset) => [preset.name, preset]));

    assert.equal(byName.get("VOX Fountain Valley")?.address, "16161 Brookhurst St, Fountain Valley, CA 92708");
    assert.equal(byName.get("VOX Fountain Valley")?.mondayLabel, "VOX FV");
    assert.equal(byName.get("VOX South Coast Plaza")?.mondayLabel, "VOX SCP");
    assert.equal(byName.get("SUP Irvine")?.mondayLabel, "SUP IR");
    assert.equal(byName.get("SUP Buena Park")?.mondayLabel, "SUP BP");
    assert.equal(byName.get("NEP Irvine")?.address, "14346 Culver Dr, Irvine, CA 92604");
    assert.equal(byName.get("NEP Fountain Valley")?.mondayLabel, "NEP FV");
    assert.equal(byName.get("ROL Fountain Valley")?.mondayLabel, "ROL FV");
    assert.equal(byName.get("ROL Irvine")?.address, "14370 Culver Dr Suite 2G, Irvine, CA 92604");
    assert.equal(byName.get("KIN")?.address, "16185 Brookhurst St, Fountain Valley, CA 92708");
    assert.equal(byName.get("Qua")?.mondayLabel, "QUA");
    assert.equal(byName.get("Kei Coffee House")?.mondayLabel, "KCH");
    assert.equal(byName.has("VOX Aliso Viejo"), false);
    assert.equal(byName.has("ROL La Habra"), false);
  } finally {
    if (previousOverride === undefined) {
      delete process.env.LOCATION_PRESETS_JSON;
    } else {
      process.env.LOCATION_PRESETS_JSON = previousOverride;
    }
  }
});
