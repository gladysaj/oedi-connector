// [Customization point]
// If you need additional properties in the item object, you can add them here
/**
 * Represents an item in the repository.
 * This is an internal representation of the item before translated
 * into a Graph API item for further ingestion to the Graph API.
 */
export interface Item {
  id: string;
  title: string;
  utility: string;
  sector: string;
  country: string;
  fixedcharge: number;
  demandunit: string;
  startdate: number;
  source: string;
  demandattrs?: any;
  energyratestructure?: any;
  iconUrl: string;
  lastModifiedBy: string;
  lastModifiedDateTime: string;
}

