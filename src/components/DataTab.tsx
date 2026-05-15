"use client";

import type { ReactNode } from "react";

export function DataTab() {
  return (
    <article className="fade-up">
      <header className="mb-8">
        <div className="citation">
          Appendix · Data sources & methodology
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          What's{" "}
          <span className="display-italic">behind the maps</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          Every layer in this atlas comes from a published research dataset.
          The sections below list each source, how it was processed into the
          county-level values the dashboard renders, and the specific measures
          it contributes.
        </p>
      </header>

      <div className="space-y-12">
        <DatasetSection
          index="01"
          title="Existing data center facilities"
          venue="IM3 Open Source Data Center Atlas"
          attribution="Pacific Northwest National Laboratory · v2026.02.09 · derived from OpenStreetMap"
          link={{
            href: "https://data.msdlive.org/records/p147s-4h760",
            label: "MSDLive · records p147s-4h760",
          }}
          chapter="Data Centers (Ch. I)"
          methodology={
            <>
              <p>
                A national inventory of data center facilities extracted from
                OpenStreetMap, distributed by the IM3 program. Each facility
                can appear as up to three records — a point, a building
                footprint, and a campus polygon — so total record counts
                exceed unique-facility counts.
              </p>
              <p>
                The pipeline filters the national table to Virginia by
                <Code>state_abb=VA</Code>, retains the county FIPS code that
                the source already assigns to every row, and emits per-county
                counts and a sum of <Code>sqft</Code> (with point records
                contributing zero area). Lat/lon and operator metadata are
                preserved at the point layer for the on-map detail panel.
              </p>
            </>
          }
          measures={[
            ["total_data_center_count", "All records per county (sum across point + building + campus)."],
            ["point_data_center_count", "Records tagged as OSM points only."],
            ["building_data_center_count", "Records tagged as building footprints only."],
            ["campus_data_center_count", "Records tagged as campus polygons only."],
            ["total_data_center_sqft", "Sum of facility area; points contribute 0."],
          ]}
        />

        <DatasetSection
          index="02"
          title="Projected data center siting"
          venue="IM3 CERF — Data Centers model"
          attribution="Pacific Northwest National Laboratory, DOE Office of Science · 20 scenarios (4 demand × 5 market-gravity)"
          link={{
            href: "https://data.msdlive.org/records/r0cga-34g05",
            label: "MSDLive · records r0cga-34g05",
          }}
          chapter="Data Center Pressure (Ch. II)"
          methodology={
            <>
              <p>
                The Capacity Expansion Regional Feasibility (CERF) model
                places ~3,770 candidate data center facilities across the
                contiguous US under each of 20 scenarios. Every candidate is
                a uniform 1,000,000 ft² campus that has passed screening for
                power, water, land, and exclusion-zone constraints. The
                county detail panel surfaces six measures derived from this
                placement.
              </p>
              <p>
                The pipeline reads each scenario's polygon file
                (ESRI:102003 Albers Equal Area Conic), reprojects to WGS84,
                computes centroids, and spatial-joins them against 2020
                Census county boundaries to assign FIPS. Per-feature
                attributes (IT power, cost, cooling water demand and
                consumption) are summed per county per scenario.
                Important: a candidate's <Code>id</Code> is NOT stable across
                scenarios — each scenario is an independent re-siting.
              </p>
            </>
          }
          measures={[
            ["projected_data_center_count", "Candidate facilities per county per scenario."],
            ["total_projected_it_power_mw", "Sum of IT-power capacity (MW)."],
            ["total_projected_campus_sqft", "Sum of campus footprint area."],
            ["total_projected_cost_million_usd", "Sum of locational siting cost (millions USD)."],
            ["total_projected_water_demand_mgy", "Cooling water withdrawal (million gal/yr)."],
            ["total_projected_water_consumption_mgy", "Cooling water consumption (≈80% of demand for evaporative)."],
          ]}
        />

        <DatasetSection
          index="03"
          title="EV charging station inventory"
          venue="CHARGE-MAP simulated charging network"
          attribution="UVA Biocomplexity Institute · va_2030_run30 scenario · 5,515 simulated stations across Virginia"
          chapter="EV Infrastructure (Ch. III)"
          methodology={
            <>
              <p>
                A synthetic 2030 EV charging station inventory generated by
                the CHARGE-MAP framework, which places stations under
                uncertainty and flags transformer upgrades. Each station has
                a level (L1 / L2 / L3) and a count of physical chargers; a
                station with multiple charger levels is counted at every
                level it has.
              </p>
              <p>
                Station lat/lon were spatial-joined to 2020 Census county
                polygons. The pipeline emits per-county counts of stations
                (with deduplication inside each level) and counts of
                individual chargers (no deduplication, since these are
                physical hardware). Station-level fields persist on the
                point layer for the on-map detail panel.
              </p>
            </>
          }
          measures={[
            ["total_station_count", "Distinct stations per county."],
            ["l1_station_count", "Stations with ≥ 1 Level 1 charger."],
            ["l2_station_count", "Stations with ≥ 1 Level 2 charger."],
            ["l3_station_count", "Stations with ≥ 1 Level 3 (DC fast) charger."],
            ["total_charger_count", "All individual chargers, summed across levels."],
            ["l1_charger_count / l2_ / l3_", "Charger counts at each level."],
          ]}
        />

        <DatasetSection
          index="04"
          title="EV charging demand (hourly)"
          venue="CHARGE-MAP simulated charging events"
          attribution="UVA Biocomplexity Institute · va_2026_run2_eval30 scenario · typical-day hourly profile"
          chapter="EV Infrastructure (Ch. III)"
          methodology={
            <>
              <p>
                A second CHARGE-MAP output: hourly charging-event records
                across roughly 65,000 charging locations in Virginia under
                the 2026 scenario, aggregated to a typical-day profile.
                <Code>datetime</Code> values like <Code>2026-01-01T07:00:00</Code>{" "}
                represent the hour of day, not a specific calendar date.
              </p>
              <p>
                Per (county, hour-of-day), the pipeline sums total kWh
                delivered and counts distinct active charging-station ids
                with nonzero throughput. Charging-location lat/lon were
                spatial-joined to 2020 county boundaries to assign FIPS.
                The dashboard renders the kWh series as the hour-of-day
                strip below the EV map.
              </p>
            </>
          }
          measures={[
            ["ev_charging_demand_kwh", "Hourly kWh delivered per county (24 hours)."],
            ["n_active_charging_locations", "Distinct active charging locations per (county, hour)."],
          ]}
        />

        <DatasetSection
          index="05"
          title="Residential adoption & PV generation"
          venue="VA 2030 synthetic-household scenario · va_2030_solar_324k_0_25ev"
          attribution="UVA Biocomplexity Institute · REVI-Twin + Thorve scidata · 3.1M synthetic households · 324,461 PV adopters, 14.6% EV, 2.6% battery statewide"
          chapter="Residential Adoption (Ch. IV)"
          methodology={
            <>
              <p>
                A one-to-one synthetic model of every Virginia household,
                each tagged with PV / EV / battery adoption flags for a 2030
                scenario, plus a 24-hour PV generation profile attached to a
                ~23% subsample of PV adopters. The dashboard exposes
                county-level adoption rates and an estimated PV generation
                curve at both county and tract resolutions.
              </p>
              <p>
                Counts (<Code>synthetic_household_count</Code>) are direct
                sums on FIPS constructed from the source admin codes.
                Adoption rates are the mean of <Code>is_pv</Code>,{" "}
                <Code>is_ev</Code>, <Code>is_battery</Code> across households
                in each geography. PV generation is computed per (geography,
                hour) by taking the mean of the per-household 24-hour profile
                across profiled adopters in the geography, then scaling by
                the total adopter count — assuming the profiled subset is
                locally representative.
              </p>
            </>
          }
          measures={[
            ["synthetic_household_count", "Households in the geography."],
            ["pv_adoption_rate", "Fraction of households flagged as PV adopters."],
            ["ev_adoption_rate", "Fraction of households flagged as EV adopters."],
            ["battery_adoption_rate", "Fraction of households flagged as battery adopters."],
            ["pv_generation_kwh", "Hourly PV generation profile (kWh, 24 hours)."],
          ]}
        />

        <DatasetSection
          index="06"
          title="Basemap & boundaries"
          venue="2020 Census county boundaries + CARTO Positron tiles"
          attribution="US Census Bureau (TIGER/Line 2020) · CARTO Positron via OpenStreetMap"
          link={{
            href: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
            label: "Census cartographic boundary files",
          }}
          chapter="All chapters"
          methodology={
            <>
              <p>
                Every choropleth uses the 2020 Census 5-digit county FIPS
                geography (133 counties + independent cities in Virginia).
                County polygons ship with the dashboard as a single GeoJSON
                file; the same file backs the geoid → name lookup that fills
                the right-side detail panel headers.
              </p>
              <p>
                Underneath the polygons, raster tiles are served by{" "}
                <Code>basemaps.cartocdn.com/light_nolabels</Code> (CARTO
                Positron), with a CSS desaturation/contrast filter applied
                site-wide to harmonize the tiles with the cream-paper
                aesthetic.
              </p>
            </>
          }
          measures={[
            ["county.geojson", "133 county polygons with geoid + region_name."],
            ["tract.geojson", "1,872 census tract polygons (lazy-loaded on the Residential tab)."],
          ]}
        />
      </div>

      <section className="mt-16 border-t border-[--color-paper-edge] pt-8">
        <div className="rule-with-mark mb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest">
            Schema notes
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SchemaNote
            title="Long format with energy extensions"
            body="Each pipeline emits long-format CSVs with (geoid, datetime, measure, value, moe, region_type, data_method, scenario). The energy category uses datetime instead of year and adds the scenario column so multi-scenario projections (data centers, EV) round-trip cleanly."
          />
          <SchemaNote
            title="Point vs measure tables"
            body="Datasets with explicit lat/lon (data centers, EV stations) emit both a long-format measure table and a GeoJSON point layer. The dashboard reads measure values from JSON and point features from GeoJSON; the on-map detail panels fill from the points."
          />
          <SchemaNote
            title="Scenario provenance"
            body="The dashboard stores measure metadata in variables.json — each (measure, scenario) pair gets a stable code (X1…XN). The provenance badge above each map surfaces the data_method (simulated, modeled, observed) and the scenario string for the active layer."
          />
          <SchemaNote
            title="Hour-of-day convention"
            body="Hourly profiles do not represent specific calendar dates. A datetime like 2026-01-01T07:00:00 in the EV demand table means 'the 7 AM hour, typical day in 2026.' The dashboard renders these as 24-step strips, not as timelines."
          />
        </div>
      </section>
    </article>
  );
}

function DatasetSection({
  index,
  title,
  venue,
  attribution,
  chapter,
  link,
  methodology,
  measures,
}: {
  index: string;
  title: string;
  venue: string;
  attribution: string;
  chapter: string;
  link?: { href: string; label: string };
  methodology: ReactNode;
  measures: Array<[string, string]>;
}) {
  return (
    <section>
      <div className="grid grid-cols-12 gap-6">
        {/* Left column: index + chapter ref */}
        <div className="col-span-12 lg:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy]">
            Dataset {index}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
            {chapter}
          </div>
        </div>

        {/* Right: dataset body */}
        <div className="col-span-12 lg:col-span-10">
          <h3 className="display text-2xl font-medium leading-tight text-[--color-ink]">
            {title}
          </h3>
          <div className="citation mt-1">
            <span className="text-[--color-energy]">{venue}</span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-[--color-ink-muted]">
            {attribution}
          </p>

          <div className="mt-4 max-w-3xl space-y-3 text-[14px] leading-relaxed text-[--color-ink]">
            {methodology}
          </div>

          {link && (
            <p className="mt-3 font-mono text-[11px]">
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[--color-energy-deep] underline decoration-[--color-paper-edge] hover:decoration-[--color-energy]"
              >
                {link.label} ↗
              </a>
            </p>
          )}

          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Measures contributed
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              {measures.map(([key, desc]) => (
                <div key={key} className="border-l-2 border-[--color-paper-edge] pl-3">
                  <dt className="font-mono text-[11px] text-[--color-ink]">
                    {key}
                  </dt>
                  <dd className="mt-0.5 text-[11px] leading-snug text-[--color-ink-muted]">
                    {desc}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function SchemaNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-[--color-paper-edge] pl-4">
      <h4 className="display text-base font-medium text-[--color-ink]">
        {title}
      </h4>
      <p className="mt-1 text-[12px] leading-relaxed text-[--color-ink-muted]">
        {body}
      </p>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-[--color-paper-edge] bg-[--color-paper-deep] px-1 py-px font-mono text-[11px] text-[--color-ink]">
      {children}
    </code>
  );
}
