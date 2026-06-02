/**
 * Build-time data transform: CSV.xz from social-data-commons → JSON in public/data/.
 *
 * Phase 2 adds EVChargingStations (8 static measures) and EVChargingDemand
 * (2 hourly measures stored as 24-element arrays). Static measures stay scalar;
 * hourly measures become arrays in [hour 0, ..., hour 23] order.
 *
 * Phase 4 adds DataCentersProjected (6 measures × 20 scenarios) and splits the
 * combined projected-points GeoJSON into 20 per-scenario files.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lzma = require("lzma-native");

const SOURCE_DIR = path.resolve(
  process.cwd(),
  "../social-data-commons/dashboard_data/va_energy_data"
);
const OUT_DATA = path.resolve(process.cwd(), "public/data");
const OUT_GEO = path.resolve(process.cwd(), "public/geo");

mkdirSync(OUT_DATA, { recursive: true });
mkdirSync(OUT_GEO, { recursive: true });

// --- GeoJSON splitter ---

/**
 * Split a combined GeoJSON FeatureCollection by a `properties.<key>` value,
 * writing one file per unique value to `outDir/<sanitized_value>.geojson`.
 * Returns the sorted list of scenario values and per-scenario feature counts.
 */
function splitGeoJsonByProperty(
  inputPath: string,
  propertyKey: string,
  outDir: string
): { values: string[]; counts: Record<string, number> } {
  mkdirSync(outDir, { recursive: true });
  const data = JSON.parse(readFileSync(inputPath, "utf8")) as {
    type: string;
    features: Array<{ properties?: Record<string, unknown> }>;
    [k: string]: unknown;
  };
  const groups: Record<string, typeof data.features> = {};
  for (const feat of data.features) {
    const v = String(feat.properties?.[propertyKey] ?? "");
    if (!v) continue;
    if (!groups[v]) groups[v] = [];
    groups[v].push(feat);
  }
  if (Object.keys(groups).length === 0) {
    throw new Error(
      `splitGeoJsonByProperty: no features had property '${propertyKey}'. ` +
        `Check the GeoJSON schema — available keys: ${
          data.features[0]
            ? Object.keys(data.features[0].properties ?? {}).join(", ")
            : "(no features)"
        }`
    );
  }
  const counts: Record<string, number> = {};
  for (const [v, feats] of Object.entries(groups)) {
    const safe = v.replace(/[^A-Za-z0-9_]/g, "_");
    const out = { type: "FeatureCollection", features: feats };
    writeFileSync(path.join(outDir, `${safe}.geojson`), JSON.stringify(out));
    counts[v] = feats.length;
  }
  return { values: Object.keys(groups).sort(), counts };
}

interface CsvRow {
  geoid: string;
  datetime: string;
  measure: string;
  value: string;
  moe: string;
  region_type: string;
  data_method: string;
  scenario: string;
}

async function decompressCsvXz(p: string): Promise<string> {
  const buf = readFileSync(p);
  return new Promise((resolve, reject) => {
    lzma.decompress(buf, (decoded: Buffer | string, err: Error | null) => {
      if (err) reject(err);
      else resolve(decoded.toString());
    });
  });
}

async function loadLongFormatCsv(filename: string): Promise<CsvRow[]> {
  const fullPath = path.join(SOURCE_DIR, filename);
  const text = await decompressCsvXz(fullPath);
  return parse(text, { columns: true, skip_empty_lines: true }) as CsvRow[];
}

// --- variable code allocator ---

interface VariableMeta {
  measure: string;
  scenario: string;
  data_method: string;
  hourly: boolean;
}

const variableCodes: Record<string, string> = {}; // measure_scenario → code
const variableMeta: Record<string, VariableMeta> = {};
let nextCodeIndex = 1;

function codeFor(
  measure: string,
  scenario: string,
  data_method: string,
  hourly: boolean
): string {
  const key = `${measure}__${scenario}`;
  if (!variableCodes[key]) {
    const code = `X${nextCodeIndex++}`;
    variableCodes[key] = code;
    variableMeta[code] = { measure, scenario, data_method, hourly };
  }
  return variableCodes[key];
}

// --- per-pipeline loaders ---

type CountyValues = Record<string, number | (number | null)[]>;
type CountyData = Record<string, CountyValues>;

async function loadDataCentersCounty(): Promise<CountyData> {
  const rows = await loadLongFormatCsv("va_ct_im3_2026_data_centers.csv.xz");
  const out: CountyData = {};
  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method, false);
    if (!out[row.geoid]) out[row.geoid] = {};
    out[row.geoid][code] = Number(row.value);
  }
  return out;
}

async function loadEVChargingStationsCounty(): Promise<CountyData> {
  const rows = await loadLongFormatCsv(
    "va_ct_sim_2030_run30_ev_charging_stations.csv.xz"
  );
  const out: CountyData = {};
  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method, false);
    if (!out[row.geoid]) out[row.geoid] = {};
    out[row.geoid][code] = Number(row.value);
  }
  return out;
}

/**
 * EVChargingDemand: 2 measures × 24 hours per county.
 * Encode each (county, measure) as a 24-element array keyed by hour (0..23).
 */
async function loadEVChargingDemandCounty(): Promise<CountyData> {
  const rows = await loadLongFormatCsv(
    "va_ct_sim_2026_ev_charging_demand.csv.xz"
  );
  const out: CountyData = {};

  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method, true);

    // Parse "YYYY-MM-DDTHH:00:00" → hour integer
    const hourMatch = row.datetime.match(/T(\d{2}):/);
    if (!hourMatch) {
      throw new Error(
        `EV demand row has unexpected datetime '${row.datetime}' (expected ISO with hour)`
      );
    }
    const hour = Number(hourMatch[1]);

    if (!out[row.geoid]) out[row.geoid] = {};
    if (!Array.isArray(out[row.geoid][code])) {
      out[row.geoid][code] = new Array(24).fill(0) as number[];
    }
    (out[row.geoid][code] as number[])[hour] = Number(row.value);
  }
  return out;
}

// --- DataCentersProjected (6 measures × 20 scenarios) ---

async function loadDataCentersProjectedCounty(): Promise<CountyData> {
  const rows = await loadLongFormatCsv(
    "va_ct_im3_2035_data_centers_projected.csv.xz"
  );
  const out: CountyData = {};
  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method, false);
    if (!out[row.geoid]) out[row.geoid] = {};
    out[row.geoid][code] = Number(row.value);
  }
  return out;
}

/**
 * ResidentialEnergyScenario: 5 measures — 4 static scalars + 1 hourly array.
 * pv_generation_kwh: 24-element array (one row per hour, datetime carries T##:).
 * All other measures: scalar (datetime is "2030-01-01").
 * Supports both county and tract region_type.
 */
async function loadResidentialByRegion(regionType: "county" | "tract"): Promise<CountyData> {
  const rows = await loadLongFormatCsv(
    "va_cttr_sim_2030_residential_energy_scenario.csv.xz"
  );
  const out: CountyData = {};

  for (const row of rows) {
    if (row.region_type !== regionType) continue;
    const valueRaw = row.value;
    if (valueRaw === "" || valueRaw === undefined) continue;

    // `pv_generation_kwh` is hourly (datetime carries an hour)
    // All other residential measures are static (datetime is "2030-01-01")
    const isHourly = row.measure === "pv_generation_kwh";
    const code = codeFor(row.measure, row.scenario, row.data_method, isHourly);

    if (!out[row.geoid]) out[row.geoid] = {};

    if (isHourly) {
      const hourMatch = row.datetime.match(/T(\d{2}):/);
      if (!hourMatch) {
        // Static row in a column we expected to be hourly — skip
        continue;
      }
      const hour = Number(hourMatch[1]);
      if (!Array.isArray(out[row.geoid][code])) {
        out[row.geoid][code] = new Array(24).fill(null) as (number | null)[];
      }
      const val = Number(valueRaw);
      (out[row.geoid][code] as (number | null)[])[hour] = Number.isFinite(val)
        ? val
        : null;
    } else {
      const val = Number(valueRaw);
      if (Number.isFinite(val)) {
        out[row.geoid][code] = val;
      }
    }
  }
  return out;
}

/**
 * PowerInfrastructure (HIFLD): 4 observed county measures, single snapshot
 * scenario. Structurally identical to DataCenters — scalar values, no hours.
 */
async function loadPowerInfrastructureCounty(): Promise<CountyData> {
  const rows = await loadLongFormatCsv(
    "va_ct_hifld_2026_power_infrastructure.csv.xz"
  );
  const out: CountyData = {};
  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method, false);
    if (!out[row.geoid]) out[row.geoid] = {};
    out[row.geoid][code] = Number(row.value);
  }
  return out;
}

// --- merge per-pipeline outputs ---

function mergeCountyData(a: CountyData, b: CountyData): CountyData {
  const merged: CountyData = { ...a };
  for (const geoid of Object.keys(b)) {
    if (!merged[geoid]) merged[geoid] = {};
    Object.assign(merged[geoid], b[geoid]);
  }
  return merged;
}

// --- main ---

async function main() {
  console.log("Building data from", SOURCE_DIR);

  const dataCenters = await loadDataCentersCounty();
  console.log(`  DataCenters: ${Object.keys(dataCenters).length} counties`);

  const evStations = await loadEVChargingStationsCounty();
  console.log(`  EVChargingStations: ${Object.keys(evStations).length} counties`);

  const evDemand = await loadEVChargingDemandCounty();
  console.log(`  EVChargingDemand: ${Object.keys(evDemand).length} counties`);

  const residentialCounty = await loadResidentialByRegion("county");
  console.log(
    `  Residential (county): ${Object.keys(residentialCounty).length} counties`
  );

  const residentialTract = await loadResidentialByRegion("tract");
  console.log(
    `  Residential (tract): ${Object.keys(residentialTract).length} tracts`
  );

  const dcProjected = await loadDataCentersProjectedCounty();
  console.log(
    `  DataCentersProjected: ${Object.keys(dcProjected).length} counties × 20 scenarios`
  );

  const powerInfra = await loadPowerInfrastructureCounty();
  console.log(
    `  PowerInfrastructure: ${Object.keys(powerInfra).length} counties`
  );

  const counties = mergeCountyData(
    mergeCountyData(
      mergeCountyData(
        mergeCountyData(
          mergeCountyData(dataCenters, evStations),
          evDemand
        ),
        residentialCounty
      ),
      dcProjected
    ),
    powerInfra
  );
  console.log(`  Merged counties: ${Object.keys(counties).length}`);

  writeFileSync(path.join(OUT_DATA, "county.json"), JSON.stringify(counties));
  writeFileSync(
    path.join(OUT_DATA, "tract.json"),
    JSON.stringify(residentialTract)
  );
  writeFileSync(
    path.join(OUT_DATA, "variables.json"),
    JSON.stringify(variableMeta, null, 2)
  );
  console.log(`  variables.json: ${Object.keys(variableMeta).length} variables`);

  // Pass-through scenarios.json
  copyFileSync(
    path.join(SOURCE_DIR, "scenarios.json"),
    path.join(OUT_DATA, "scenarios.json")
  );

  // Boundary + point GeoJSONs
  copyFileSync(
    path.join(SOURCE_DIR, "va_geo_county_2020.geojson"),
    path.join(OUT_GEO, "county.geojson")
  );

  copyFileSync(
    path.join(SOURCE_DIR, "va_geo_tract_2020.geojson"),
    path.join(OUT_GEO, "tract.geojson")
  );

  copyFileSync(
    path.join(SOURCE_DIR, "va_pt_sim_2030_va_2030_run30_ev_charging_stations.geojson"),
    path.join(OUT_GEO, "ev_stations.geojson")
  );

  copyFileSync(
    path.join(SOURCE_DIR, "va_pt_sim_2026_ev_charging_demand.geojson"),
    path.join(OUT_GEO, "ev_demand_locations.geojson")
  );

  // DataCenters existing (319 sites, single scenario)
  copyFileSync(
    path.join(SOURCE_DIR, "va_pt_im3_2026_data_centers.geojson"),
    path.join(OUT_GEO, "dc_existing.geojson")
  );

  // PowerInfrastructure (HIFLD) — 1,571 points (plants + substations)
  copyFileSync(
    path.join(SOURCE_DIR, "va_pt_hifld_2026_power_infrastructure.geojson"),
    path.join(OUT_GEO, "power_infrastructure.geojson")
  );

  // DataCentersProjected — split the combined GeoJSON into 20 per-scenario files.
  // Actual filename: va_pt_im3_2035_data_centers_projected.geojson
  // (differs from the plan's assumed name which included _va_2030_run30_)
  const projectedInput = path.join(
    SOURCE_DIR,
    "va_pt_im3_2035_data_centers_projected.geojson"
  );
  const projectedOutDir = path.join(OUT_GEO, "dc_projected");
  const split = splitGeoJsonByProperty(projectedInput, "scenario", projectedOutDir);
  const totalSplitFeatures = Object.values(split.counts).reduce(
    (a, b) => a + b,
    0
  );
  console.log(
    `  dc_projected: ${split.values.length} scenarios, ${totalSplitFeatures} total features`
  );

  // Write the scenario list for Tab 3's selector
  writeFileSync(
    path.join(OUT_DATA, "dc_scenarios.json"),
    JSON.stringify(split.values, null, 2)
  );
  console.log(`  dc_scenarios.json: ${split.values.length} scenarios`);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
