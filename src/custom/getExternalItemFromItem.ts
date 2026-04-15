import { Item } from "../models/Item";
import { ExternalConnectors } from "@microsoft/microsoft-graph-types";
import { getAclFromItem } from "./getAclFromItem";

function describeDemandAttrs(demandattrs: any): string {
  if (!demandattrs || !Array.isArray(demandattrs) || demandattrs.length === 0) return "";
  const tiers = demandattrs
    .filter((t: any) => t && (t.rate !== undefined || t.unit))
    .map((t: any) => {
      const rate = t.rate !== undefined ? `$${t.rate}` : "";
      const unit = t.unit ? `per ${t.unit}` : "";
      const max = t.max !== undefined ? `up to ${t.max} ${t.unit ?? ""}` : "";
      return [rate, unit, max].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  return tiers.length > 0 ? `Demand charge tiers: ${tiers.join("; ")}.` : "";
}

function describeEnergyRates(energyratestructure: any): string {
  if (!energyratestructure || !Array.isArray(energyratestructure) || energyratestructure.length === 0) return "";
  const rates: string[] = [];
  energyratestructure.forEach((period: any, i: number) => {
    if (!Array.isArray(period)) return;
    period.forEach((tier: any) => {
      if (tier?.rate !== undefined) {
        rates.push(`Period ${i + 1}: $${tier.rate} per ${tier.unit ?? "kWh"}`);
      }
    });
  });
  return rates.length > 0 ? `Energy rate structure: ${rates.slice(0, 6).join("; ")}.` : "";
}

export function getExternalItemFromItem(item: Item): ExternalConnectors.ExternalItem {
  const demandText = describeDemandAttrs(item.demandattrs);
  const energyText = describeEnergyRates(item.energyratestructure);
  const effectiveDate = item.startdate
    ? new Date(item.startdate * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const content = [
    `${item.title} is an industrial utility rate plan offered by ${item.utility ?? "an unknown utility"} in ${item.country ?? "an unknown country"}.`,
    item.sector ? `This rate applies to the ${item.sector} sector.` : "",
    item.fixedcharge != null ? `The fixed charge is $${item.fixedcharge} per meter.` : "",
    item.demandunit ? `Demand charges are measured in ${item.demandunit}.` : "",
    demandText,
    energyText,
    effectiveDate ? `This rate became effective on ${effectiveDate}.` : "",
    item.source ? `For full tariff details see: ${item.source}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: item.id,
    acl: getAclFromItem(item),
    properties: {
      title: item.title,
      utility: item.utility,
      sector: item.sector,
      country: item.country,
      fixedcharge: item.fixedcharge,
      demandunit: item.demandunit,
      startdate: item.startdate ? new Date(item.startdate * 1000).toISOString() : undefined,
      source: item.source,
      iconUrl: item.iconUrl,
      lastModifiedBy: item.lastModifiedBy,
      lastModifiedDateTime: item.lastModifiedDateTime,
    },
    content: {
      value: content,
      type: "text",
    },
  };
}
