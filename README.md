# Mosaic

Mosaic is a reporting workspace you install next to the systems a manufacturing
or sales-force company already runs. You register the customer as a tenant,
point Mosaic at their MongoDB database, and it reads the records the way a plant
or sales lead would — orders, pipeline, work orders, yield, stock — then opens
boards they can use on a Monday morning.

Every report lives inside that customer tenant. Two companies never share a
workspace. People ask questions in plain language. They do not write queries,
and they do not walk a five-step designer.

## What it does

**Registers a customer company.** Name, whether they manufacture, sell, or both.
Everything after that — databases, reports, boards — belongs to that company.

**Connects their database by name.** Paste a MongoDB link, pick the database,
and Mosaic only ever reads it.

**Reads it as an operations analyst.** Collections are mapped onto real
processes (sales orders, pipeline, production, machines, inventory). Reports are
only created when the records to answer them actually exist, so a CRM never gets
a yield board and a plant never gets an empty pipeline.

**Opens on the operation, not the schema.** Home is this morning's numbers, an
ask bar, and a sales board or a plant board.

**Lets anyone ask the next question.** Type "revenue by sales rep" or "yield by
machine". Mosaic picks the number, the split and the chart. The canvas has three
controls: the number, what to split by, and how it should look.

**Optional language model.** Set `MOSAIC_AI_KEY` and Mosaic will call any
OpenAI-compatible endpoint to refine the briefing and the questions. There is no
Cursor SDK that can run inside a customer's install; without a key the
manufacturing and sales-force playbook still builds the boards.

## Running it locally

Requirements: Node.js 20 or newer, and a MongoDB database to read.

```bash
npm install
```

### With the sample database

The repo ships a script that fetches a standalone MongoDB server and runs it on
port 47017, plus a seeder that fills it with a fictional manufacturer that also
sells through a sales force: customers, products, orders, a Salesforce-style
pipeline, machines, work orders and production runs.

```bash
npm run mongo     # first run downloads MongoDB, then serves on 127.0.0.1:47017
npm run seed      # fills the northwind_trading database
```

In another terminal:

```bash
cp .env.example .env.local   # already points at the sample database
npm run dev
```

Open http://localhost:3000. On first boot Mosaic registers a sample company
(Halcyon Manufacturing), scans the database and opens sales and plant boards.

### With a real customer

Start the app, open **Register another company**, name them, pick manufacturing
or sales operations, then connect their MongoDB database. A read-only user is
enough — Mosaic never writes to the database it reports on.

## Configuration

All settings are environment variables; see `.env.example`.

| Variable | What it does |
| --- | --- |
| `MOSAIC_DATA_DIR` | Where Mosaic keeps its own state. Defaults to `./.mosaic`. |
| `MOSAIC_STORE_URI` / `MOSAIC_STORE_DB` / `MOSAIC_STORE_COLLECTION` | Keep that state in MongoDB instead of a file. |
| `MOSAIC_DEMO_URI` / `MOSAIC_DEMO_DB` / `MOSAIC_DEMO_NAME` | A database to register and scan automatically on a brand new install. Leave unset in production. |
| `MOSAIC_AI_URL` / `MOSAIC_AI_KEY` / `MOSAIC_AI_MODEL` | Optional OpenAI-compatible model for the analyst and the ask bar. |
| `NEXT_PUBLIC_MOSAIC_CURRENCY` | Currency used to format money fields. Defaults to `USD`. |
| `NEXT_PUBLIC_MOSAIC_LOCALE` | Locale used for numbers and dates. Defaults to `en-US`. |

Connections, catalogs, reports and dashboards live in a single JSON file at
`$MOSAIC_DATA_DIR/workspace.json`. Back that file up and you have backed up the
whole workspace. Connection links are stored server-side and are never sent to
the browser.

If Mosaic runs somewhere with no durable disk — a container without a mounted
volume — set `MOSAIC_STORE_URI` and the same document is kept in MongoDB
instead. That database is Mosaic's own bookkeeping and has nothing to do with
the databases it reports on; it can be a small one of its own. Either way
Mosaic expects to be a single instance, so run one copy per workspace.

## Deploying it as an agent

Mosaic is a normal Node service:

```bash
npm run build
npm run start
```

Run it on a host that can reach the databases you want to report on, give it
somewhere durable to keep its workspace (a volume for `MOSAIC_DATA_DIR`, or
`MOSAIC_STORE_URI` pointing at a MongoDB), and put it behind whatever
authentication your other internal tools use. It caches nothing — every number
is read live from the source database at the moment a report runs.

## How it is put together

```
src/
  lib/
    agent/
      client.ts        connection pooling and human-readable connection errors
      discover.ts      samples documents and builds the field catalog
      classify.ts      decides what each field is and how to format it
      concepts.ts      maps collections onto plant and sales processes
      playbook.ts      the questions a plant or sales lead actually asks
      analyst.ts       builds boards only from records that can answer them
      ask.ts           turns a plain-language question into a report
      llm.ts           optional OpenAI-compatible model
      register.ts      connects a database and runs the analyst
    tenant.ts          the customer company this session is working in
    store.ts           tenants, connections, reports and boards
    query/
      compile.ts       report spec  ->  MongoDB aggregation pipeline
      run.ts           executes a spec and normalises the result
      shape.ts         reshapes flat results for charting
      warnings.ts      explains when a breakdown will inflate the numbers
    types.ts           the report spec and catalog schemas
  components/
    builder/           the report canvas (ask, pick a number, split, chart)
    tenant/            company registration
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
