# Mosaic

Mosaic is a reporting agent you install next to a MongoDB database. Point it at a
database once and it works out what is inside — what each collection holds, what
every field means, and how the collections link together. From then on anyone on
the team can build dashboards and reports by picking things from a list, without
knowing a collection name, a field path, or a line of query syntax.

It exists because report requests never stop. Every project ends up needing its
own bespoke report screen, and every one of those needs somebody who already
knows the schema. Mosaic replaces that work with a self-service builder that
learns each new database on its own.

## What it does

**Registers a database and reads it.** Paste a connection link, choose a
database and Mosaic samples every collection to build a catalog. For each field
it records the types it saw, how often the field is present, how many distinct
values it holds, its value range and a few real examples.

**Names things in plain language.** `order_items.unitPriceUSD` becomes
"Order Items › Unit Price USD". `support_tickets` becomes "Support Tickets", and
the app knows the singular is "support ticket" so sentences read properly.

**Works out what each field is for.** Every field is sorted into a role — a
number you can add up, a date you can trend, a category you can group by, a
yes/no flag, a reference, or free text — and given a display format such as
money, percentage or whole number. Stored timestamps, numeric IDs that should
never be summed, and secret-looking fields are all detected and handled.

**Finds links between collections.** A field called `customerId` is matched
against the `customers` collection, then verified by checking that real values
actually point at real documents before the link is recorded.

**Suggests where to start.** After a scan, Mosaic ranks the collections by how
interesting they are for reporting and assembles a starter dashboard from them,
so a fresh install opens on something useful rather than an empty state.

**Lets anyone build the rest.** The builder is five plain steps: what to look at,
what to measure, how to break it down, what to include, and how to show it. The
chart updates as you go. Behind it, a compiler turns the choices into a MongoDB
aggregation pipeline, which you can inspect at any time under "Show the query".

**Dashboards.** Arrange saved reports into a grid, resize tiles, and set one
time range that applies to every tile that has a date.

**Corrections stick.** Everything the agent guessed is editable in the data
catalog — labels, roles, formats, what stays hidden, which date drives time
filters. Reports follow your wording, not the database's.

## Running it locally

Requirements: Node.js 20 or newer, and a MongoDB database to read.

```bash
npm install
```

### With the sample database

The repo ships a script that fetches a standalone MongoDB server and runs it on
port 47017, plus a seeder that fills it with a fictional trading company:
customers, products, orders with line items, support tickets and web sessions,
covering two years with realistic seasonality.

```bash
npm run mongo     # first run downloads MongoDB, then serves on 127.0.0.1:47017
npm run seed      # fills the northwind_trading database
```

In another terminal:

```bash
cp .env.example .env.local   # already points at the sample database
npm run dev
```

Open http://localhost:3000. On first boot Mosaic registers the sample database,
scans it and builds a starter dashboard automatically.

### With your own database

Skip the seed step. Start the app, open **Your data → Connect a database** and
paste your connection link. A read-only user is enough — Mosaic never writes to
the database it reports on.

## Configuration

All settings are environment variables; see `.env.example`.

| Variable | What it does |
| --- | --- |
| `MOSAIC_DATA_DIR` | Where Mosaic keeps its own state. Defaults to `./.mosaic`. |
| `MOSAIC_DEMO_URI` / `MOSAIC_DEMO_DB` / `MOSAIC_DEMO_NAME` | A database to register and scan automatically on a brand new install. Leave unset in production. |
| `NEXT_PUBLIC_MOSAIC_CURRENCY` | Currency used to format money fields. Defaults to `USD`. |
| `NEXT_PUBLIC_MOSAIC_LOCALE` | Locale used for numbers and dates. Defaults to `en-US`. |

Connections, catalogs, reports and dashboards live in a single JSON file at
`$MOSAIC_DATA_DIR/workspace.json`. Back that file up and you have backed up the
whole workspace. Connection links are stored server-side and are never sent to
the browser.

## Deploying it as an agent

Mosaic is a normal Node service:

```bash
npm run build
npm run start
```

Run it on a host that can reach the databases you want to report on, give it a
persistent volume for `MOSAIC_DATA_DIR`, and put it behind whatever
authentication your other internal tools use. It holds no data of its own — every
number is read live from the source database at the moment a report runs.

## How it is put together

```
src/
  lib/
    agent/
      client.ts        connection pooling and human-readable connection errors
      discover.ts      samples documents and builds the field catalog
      classify.ts      decides what each field is and how to format it
      naming.ts        turns identifiers into English
      measures.ts      picks the right summary for a number, and names it
      register.ts      registers a source, scans it, builds the starter dashboard
      suggest.ts       proposes starter reports for a collection
    query/
      compile.ts       report spec  ->  MongoDB aggregation pipeline
      run.ts           executes a spec and normalises the result
      shape.ts         reshapes flat results for charting
      warnings.ts      explains when a breakdown will inflate the numbers
    store.ts           the JSON-backed workspace
    types.ts           the report spec and catalog schemas
  components/
    builder/           the report builder
    dashboard/         dashboard grid and tiles
    charts/            chart rendering
    data/              connect wizard and data catalog
  app/
    api/               connections, catalog, query, reports, dashboards, export
```

The report spec in `src/lib/types.ts` is the contract between the UI and the
query compiler. Everything the builder produces is a plain, serialisable object,
which is why reports can be saved, shared through a URL and re-run unchanged.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run mongo` | Fetch and run a local MongoDB for development |
| `npm run seed` | Fill the local MongoDB with the sample company |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
