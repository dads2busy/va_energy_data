/**
 * Build-time data transform: CSV.xz from social-data-commons → JSON in public/data/.
 *
 * Phase 1 wires only the DataCenters county CSV. Subsequent phases extend
 * SOURCE_FILES and the wide-format keying logic.
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

const variableCodes: Record<string, string> = {}; // measure_scenario → code (e.g., "X1")
const variableMeta: Record<
  string,
  { measure: string; scenario: string; unit?: string; data_method: string }
> = {};
let nextCodeIndex = 1;

function codeFor(
  measure: string,
  scenario: string,
  data_method: string
): string {
  const key = `${measure}__${scenario}`;
  if (!variableCodes[key]) {
    const code = `X${nextCodeIndex++}`;
    variableCodes[key] = code;
    variableMeta[code] = { measure, scenario, data_method };
  }
  return variableCodes[key];
}

// --- per-pipeline loaders (Phase 1: just DataCenters) ---

async function loadDataCentersCounty(): Promise<Record<string, Record<string, number>>> {
  const rows = await loadLongFormatCsv("va_ct_im3_2026_data_centers.csv.xz");

  // county.json shape: { "51001": { "X1": 0.5, ... }, ... }
  const out: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    if (row.region_type !== "county") continue;
    const code = codeFor(row.measure, row.scenario, row.data_method);
    if (!out[row.geoid]) out[row.geoid] = {};
    out[row.geoid][code] = Number(row.value);
  }
  return out;
}

// --- main ---

async function main() {
  console.log("Building data from", SOURCE_DIR);

  const counties = await loadDataCentersCounty();

  writeFileSync(
    path.join(OUT_DATA, "county.json"),
    JSON.stringify(counties)
  );
  console.log(`  county.json: ${Object.keys(counties).length} counties`);

  writeFileSync(
    path.join(OUT_DATA, "variables.json"),
    JSON.stringify(variableMeta, null, 2)
  );
  console.log(`  variables.json: ${Object.keys(variableMeta).length} variables`);

  // scenarios.json: pass-through
  const scenariosPath = path.join(SOURCE_DIR, "scenarios.json");
  copyFileSync(scenariosPath, path.join(OUT_DATA, "scenarios.json"));
  console.log("  scenarios.json copied");

  // county boundary GeoJSON
  copyFileSync(
    path.join(SOURCE_DIR, "va_geo_county_2020.geojson"),
    path.join(OUT_GEO, "county.geojson")
  );
  console.log("  county.geojson copied");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
