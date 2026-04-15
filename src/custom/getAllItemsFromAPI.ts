import type { Config } from "../models/Config";
import type { Item } from "../models/Item";

// _config and _since are kept for interface compatibility with itemsService.
// OpenEI does not expose a delta filter, so all crawls are full crawls.
export async function* getAllItemsFromAPI(_config: Config, _since?: Date): AsyncGenerator<Item> {
  const apiKey = process.env.OPENEI_API_KEY ?? "";
  if (!apiKey) throw new Error("Missing OPENEI_API_KEY in env");

  const baseUrl = "https://api.openei.org/utility_rates";
  const limit = 100;
  const maxItems = parseInt(process.env.OPENEI_MAX_ITEMS ?? "500");
  let offset = 0;
  let totalYielded = 0;

  while (true) {
    const params = new URLSearchParams({
      version: "latest",
      format: "json",
      api_key: apiKey,
      sector: "Industrial",
      limit: String(limit),
      offset: String(offset),
      detail: "full",
    });

    const res = await fetch(`${baseUrl}?${params.toString()}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenEI failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    const items: any[] = data.items ?? [];

    for (const rate of items) {
      yield {
        id: rate.label,
        title: rate.name,
        utility: rate.utility,
        sector: rate.sector,
        country: rate.country,
        fixedcharge: rate.fixedchargefirstmeter,
        demandunit: rate.demandrateunit ?? rate.demandunits,
        startdate: rate.startdate,
        source: rate.source?.startsWith("http") ? rate.source : `https://openei.org/apps/USURDB/rate/view/${rate.label}`,
        demandattrs: rate.demandattrs,
        energyratestructure: rate.energyratestructure,
        iconUrl: "https://openei.org/favicon.ico",
        lastModifiedBy: rate.utility ?? "OpenEI",
        lastModifiedDateTime: rate.startdate
          ? new Date(rate.startdate * 1000).toISOString()
          : new Date().toISOString(),
      };
      totalYielded++;
      if (totalYielded >= maxItems) return;
    }

    if (items.length < limit) break;
    offset += limit;
  }
}
