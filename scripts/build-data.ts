/**
 * Build-time data transform: CSV.xz from social-data-commons → JSON in public/data/.
 *
 * Phase 2 adds EVChargingStations (8 static measures) and EVChargingDemand
 * (2 hourly measures stored as 24-element arrays). Static measures stay scalar;
 * hourly measures become arrays in [hour 0, ..., hour 23] order.
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

type CountyValues = Record<string, number | number[]>;
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

  const counties = mergeCountyData(mergeCountyData(dataCenters, evStations), evDemand);
  console.log(`  Merged: ${Object.keys(counties).length} counties total`);

  writeFileSync(path.join(OUT_DATA, "county.json"), JSON.stringify(counties));
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
    path.join(SOURCE_DIR, "va_pt_sim_2030_va_2030_run30_ev_charging_stations.geojson"),
    path.join(OUT_GEO, "ev_stations.geojson")
  );

  copyFileSync(
    path.join(SOURCE_DIR, "va_pt_sim_2026_ev_charging_demand.geojson"),
    path.join(OUT_GEO, "ev_demand_locations.geojson")
  );

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
