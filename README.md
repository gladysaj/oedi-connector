# OEDI Copilot Connector

A **Microsoft 365 Copilot Connector** (formerly Graph Connector) that indexes industrial utility rate data from the [OpenEI Utility Rates Database (USURDB)](https://openei.org/wiki/Utility_Rate_Database) into Microsoft Graph — making it searchable in Microsoft Search, SharePoint, and Microsoft 365 Copilot.

Built on the [Microsoft 365 Agents Toolkit](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/teams-toolkit-fundamentals) Azure Functions v4 connector template.

---

## What it does

- Connects to the [OpenEI REST API](https://api.openei.org/utility_rates) and fetches industrial utility rate plans
- Indexes up to N items (configurable) into Microsoft Graph as external items
- Makes rates searchable by utility name, sector, country, fixed charge, and demand unit
- Surfaces results in Microsoft Search, SharePoint search, and Microsoft 365 Copilot
- Supports a declarative agent in Copilot Studio that answers questions about utility rates

### Data indexed per rate

| Property | Type | Description |
|---|---|---|
| `title` | String | Rate plan name |
| `utility` | String | Utility company name |
| `sector` | String | Customer sector (Industrial) |
| `country` | String | Country |
| `fixedcharge` | Double | Fixed charge per meter ($) |
| `demandunit` | String | Unit for demand charges |
| `startdate` | DateTime | Rate effective date |
| `source` | String (URL) | Link to full tariff on OpenEI |
| `iconUrl` | String | OpenEI favicon |
| `lastModifiedBy` | String | Utility name or "OpenEI" |
| `lastModifiedDateTime` | DateTime | Last modification timestamp |

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Microsoft 365 Agents Toolkit VS Code extension](https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- [Azurite VS Code extension](https://marketplace.visualstudio.com/items?itemName=Azurite.azurite) (local Azure Storage emulator)
- A **Microsoft 365 tenant** with admin access (or rights to grant admin consent in Entra)
- An **OpenEI API key** — get one free at [https://openei.org/services/api/signup/](https://openei.org/services/api/signup/)

---

## Local setup (run without Azure)

This is the recommended way to get started. It runs entirely locally using Azurite for storage and your Microsoft 365 tenant for the Graph connection.

### 1. Clone the repo

```powershell
git clone https://github.com/YOUR_USERNAME/oedi-connector.git
cd oedi-connector
```

### 2. Install dependencies

```powershell
npm install
```

### 3. Create your local environment file

Create the file `env/.env.local` — this file is gitignored and will never be committed.

```env
TEAMSFX_ENV=local
APP_NAME_SUFFIX=local
AZURE_TOKEN_CREDENTIALS=dev
CONNECTOR_ID=oediconnectorv2
CONNECTOR_NAME=OEDI Connector
CONNECTOR_DESCRIPTION=Connection that indexes OEDI utility rate data from OpenEI REST API.
OPENEI_API_KEY=YOUR_OPENEI_API_KEY_HERE
OPENEI_MAX_ITEMS=200
```

Replace `YOUR_OPENEI_API_KEY_HERE` with your actual OpenEI API key.

`OPENEI_MAX_ITEMS` controls how many rate plans are indexed per crawl. Start with 200. The connector paginates the OpenEI API automatically (100 items per page).

### 4. Provision the Azure AD app

In VS Code, open the **Microsoft 365 Agents Toolkit** panel (the toolkit icon in the sidebar):

1. Click **Provision** next to the **local** environment
2. Sign in with your Microsoft 365 admin account when prompted
3. Grant admin consent when the browser opens

This registers an Azure AD application with the required Graph permissions:
- `ExternalConnection.ReadWrite.OwnedBy`
- `ExternalItem.ReadWrite.OwnedBy`

The toolkit will automatically populate `AAD_APP_CLIENT_ID`, `AAD_APP_OBJECT_ID`, `AAD_APP_TENANT_ID`, and `AAD_APP_OAUTH_AUTHORITY` in your `env/.env.local`.

### 5. Start Azurite

In VS Code, open the Command Palette (`Ctrl+Shift+P`) and run:

```
Azurite: Start
```

### 6. Run the function

Press **F5** (or click the green play button next to **local** in the Agents Toolkit panel).

Watch the terminal output for these stages:

1. `Connection oediconnectorv2 is not ready` — creates the connection in Microsoft Graph
2. `Creating schema for connection oediconnectorv2` — registers the schema (takes ~2–3 minutes)
3. `Starting full crawl...` — begins indexing rate plans
4. `Finished full crawl...` — done, items are in the index

### 7. Verify in Microsoft 365 admin center

Go to [https://admin.microsoft.com](https://admin.microsoft.com) → **Settings** → **Search & intelligence** → **Data sources**.

You should see `oediconnectorv2` with status **Ready** and a count of indexed items.

> The item count may show as loading for 5–15 minutes after the crawl completes — this is normal. Use the **Index browser** in the admin center to confirm items are present immediately.

### 8. Enable Microsoft 365 Copilot for the connector

In the admin center Data sources page, click on `oediconnectorv2` → enable the **Microsoft 365 Copilot** toggle → Save.

Without this step, Copilot will not surface connector results.

### 9. Test in SharePoint search

Go to your SharePoint home and search for `industrial rate` or a utility name. Filter results by **Source** → `oediconnectorv2`.

> Results may take 30–60 minutes after the crawl to appear in search. The index browser confirms items are present before propagation completes.

### 10. Test in Microsoft 365 Copilot

Open Copilot at [https://copilot.microsoft.com](https://copilot.microsoft.com) or in Teams and try:

> "What industrial utility rates are available from Pacific Gas and Electric?"

> "Show me utility rate plans in California for the industrial sector."

> "What is the fixed charge for industrial rates in Texas?"

---

## Crawl schedule

| Crawl type | Schedule | Notes |
|---|---|---|
| `deployConnection` | On startup (local) / Once a year (Azure) | Creates connection + schema, triggers full crawl |
| `fullCrawl` | Daily at midnight | Re-indexes all items |
| `incrementalCrawl` | Every 6 hours | OpenEI has no delta filter, so this is a full crawl |

---

## Local management endpoints

When running locally, two HTTP endpoints are available:

**Retract (delete) the connection and all indexed items:**
```powershell
curl -X POST http://localhost:7071/api/retract
```

**Clear all indexed items (keep the connection and schema):**
```powershell
curl -X POST http://localhost:7071/api/clear
```

---

## Deploy to Azure

> Requires an Azure subscription with available Dynamic (Y1 Consumption plan) quota.

1. Create `env/.env.dev` with your Azure and connector settings
2. Create `env/.env.dev.user` with `SECRET_OPENEI_API_KEY=YOUR_KEY`
3. In VS Code Agents Toolkit → select **dev** environment → click **Provision**
4. After provisioning succeeds → click **Deploy**

The Bicep template in `infra/azure.bicep` provisions:
- Azure Function App (Consumption plan Y1)
- Storage Account
- Key Vault (stores the OpenEI API key as a secret)

---

## Build a declarative agent in Copilot Studio

Once the connector is indexed and the Copilot toggle is enabled:

1. Go to [Copilot Studio](https://copilotstudio.microsoft.com)
2. Create a new **Declarative agent**
3. Under **Knowledge** → **Add knowledge** → **Copilot connectors** → select `oediconnectorv2`
4. Use the following description and instructions:

**Description:**
> This agent helps users explore and compare industrial electricity tariffs from utilities across the United States and other countries, using data from the OpenEI Utility Rate Database (USURDB). It can answer questions about rate structures, fixed charges, demand charges, and which utilities offer specific types of industrial rate plans.

**Instructions:**
> You are a utility rate research assistant. Use the OEDI Connector knowledge source to answer questions about industrial electricity tariffs and utility rate plans. When a user asks about utility rates, fixed charges, demand charges, or rate structures, search the indexed rate data and provide clear, factual answers. Always cite the utility name, sector, and country when presenting a rate. If a source URL is available, include it so the user can view the full tariff details. If no relevant rate is found, say so clearly and suggest refining the search by utility name, country, or sector.

---

## Project structure

```
src/
  custom/
    getAllItemsFromAPI.ts      # Fetches and paginates OpenEI API data
    getExternalItemFromItem.ts # Maps OpenEI rate to Graph ExternalItem
    getAclFromItem.ts         # Sets ACL (public read for all users)
  models/
    Item.ts                   # Internal item model
    Config.ts                 # Connector configuration model
  references/
    schema.json               # Graph connector schema (11 properties)
    template.json             # Adaptive Card result template for Search
  functions/
    connections.ts            # Azure Function triggers and HTTP endpoints
  config.ts                   # Reads env vars into Config object
  connection.ts               # Graph API: create/delete/clear connection
  schema.ts                   # Graph API: register schema
  ingest.ts                   # Graph API: PUT items into index
  graphClient.ts              # Authenticated Graph client
env/
  .env.local                  # Local env vars (gitignored — create manually)
  .env.dev                    # Azure dev env vars (gitignored)
infra/
  azure.bicep                 # Azure infrastructure (Function App, KV, Storage)
  azure.parameters.json       # Bicep parameters
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `CONNECTOR_ID` | Yes | Unique ID for the Graph connection (alphanumeric, max 32 chars) |
| `CONNECTOR_NAME` | Yes | Display name shown in admin center |
| `CONNECTOR_DESCRIPTION` | Yes | Description shown in admin center |
| `OPENEI_API_KEY` | Yes | Your OpenEI API key |
| `OPENEI_MAX_ITEMS` | No | Max items to index per crawl (default: 500) |
| `AAD_APP_CLIENT_ID` | Auto | Set by Agents Toolkit during provision |
| `AAD_APP_TENANT_ID` | Auto | Set by Agents Toolkit during provision |
| `AZURE_TOKEN_CREDENTIALS` | Yes (local) | Set to `dev` for local development |

---

## Troubleshooting

**`Connection is not ready` on startup**
The connection was just created and the schema is being registered. Wait 2–3 minutes — the function retries automatically.

**`InvalidSearchAnnotationsForSemanticLabel` error**
A schema property with a semantic label is missing required flags. All labeled properties must have `isSearchable`, `isQueryable`, and `isRetrievable` set to `true` in `src/references/schema.json`.

**Items indexed but not appearing in search**
Microsoft Search index propagation takes 30–60 minutes after items are ingested. Use the Index browser in the admin center to confirm items are present, then wait.

**Connection stuck in `deleting` state (409 OperationInProgress)**
Change `CONNECTOR_ID` in `env/.env.local` to a new unique value (e.g. append `v2`, `v3`). The function creates a fresh connection and the stuck one is eventually cleaned up by Microsoft.

**Citation links return 404**
The `source` field from OpenEI may be empty for some rates. The connector falls back to constructing a direct link from the rate label: `https://openei.org/apps/USURDB/rate/view/{label}`. Confirm the fallback is present in `src/custom/getAllItemsFromAPI.ts`.

**Azure deployment fails with quota errors**
Standard and Dynamic VM quotas are often zero in new Azure subscriptions. Request a quota increase in the Azure portal, try a different region, or use local development mode in the meantime.

---

## License

MIT
