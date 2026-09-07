import "server-only";

import { defaultAggregation, metricLabel } from "./measures";
import { shortLabel } from "./naming";
import { completeJson } from "./llm";
import { classifyCollection } from "./concepts";
import type {
  Catalog,
  CollectionProfile,
  FieldProfile,
  Filter,
  Industry,
  ReportSpec,
  Visual,
} from "../types";

export type AskResult = {
  spec: ReportSpec;
  title: string;
  explanation: string;
  usedModel: boolean;
};

const OPTIONS = {
  showLegend: true,
  showValues: false,
  stacked: false,
  showTrendline: false,
  palette: "iris",
};

const PROCESS_HINTS: { process: ReturnType<typeof classifyCollection>; test: RegExp }[] = [
  { process: "work_orders", test: /\b(work orders?|job orders?|open jobs)\b/i },
  { process: "production", test: /\b(yield|scrap|produced|output|downtime|units)\b/i },
  { process: "pipeline", test: /\b(pipeline|deal|opportunit|stage|win rate)\b/i },
  { process: "sales_orders", test: /\b(revenue|sales|orders?|invoices?)\b/i },
  { process: "inventory", test: /\b(stock|inventory|on hand)\b/i },
  { process: "machines", test: /\b(machine|line|plant)\b/i },
  { process: "customers", test: /\b(customers?|accounts?)\b/i },
];

function hintedProcess(question: string) {
  for (const hint of PROCESS_HINTS) {
    if (hint.test.test(question)) return hint.process;
  }
  return undefined;
}

function scoreCollection(collection: CollectionProfile, tokens: string[], industry: Industry, question: string) {
  const process = classifyCollection(collection);
  let score = 0;
  const haystack = `${collection.name} ${collection.label} ${collection.noun}`.toLowerCase();
  for (const token of tokens) {
    if (haystack.includes(token)) score += 8;
  }
  const hinted = hintedProcess(question);
  if (hinted && process === hinted) score += 24;
  if (industry === "manufacturing" && (process === "production" || process === "work_orders" || process === "machines" || process === "inventory")) {
    score += 6;
  }
  if (industry === "sales" && (process === "sales_orders" || process === "pipeline" || process === "customers")) {
    score += 6;
  }
  if (collection.fields.some((field) => field.format === "currency")) score += 3;
  return score;
}

function pickCollection(catalog: Catalog, tokens: string[], industry: Industry, question: string) {
  const ranked = catalog.collections
    .filter((collection) => !collection.hidden)
    .map((collection) => ({ collection, score: scoreCollection(collection, tokens, industry, question) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.collection;
}

function usable(collection: CollectionProfile) {
  return collection.fields.filter((field) => !field.hidden && !field.inArray);
}

function pickMeasure(collection: CollectionProfile, tokens: string[]): FieldProfile | undefined {
  const measures = usable(collection).filter((field) => field.role === "measure");
  const named = measures.find((field) => tokens.some((token) => field.path.toLowerCase().includes(token) || field.label.toLowerCase().includes(token)));
  if (named) return named;
  if (/\b(revenue|sales|amount|value|pipeline)\b/.test(tokens.join(" "))) {
    const currency = measures.filter((field) => field.format === "currency");
    return (
      currency.find((field) => /^(total|grand_?total|total_?amount|amount|revenue|net_?total)$/i.test(field.path.split(".").pop() ?? "")) ??
      currency.find((field) => !/(discount|tax|shipping|fee|cost)/i.test(field.path)) ??
      currency[0]
    );
  }
  if (/\b(produced|output|units|yield|scrap|downtime|stock)\b/.test(tokens.join(" "))) {
    return measures.find((field) => /(produced|yield|scrap|downtime|stock|qty|quantity|units)/i.test(field.path));
  }
  return collection.fields.find((field) => field.path === collection.primaryMeasureField) ?? measures.find((field) => field.format === "currency");
}

function pickCategory(collection: CollectionProfile, tokens: string[]): FieldProfile | undefined {
  const categories = usable(collection).filter(
    (field) => (field.role === "category" || field.role === "boolean") && field.distinct > 1 && field.distinct <= 60,
  );
  const hints: [RegExp, RegExp][] = [
    [/\b(rep|owner|salesperson|manager)\b/, /(rep|owner|manager|salesperson)/i],
    [/\b(country|region|territory|city)\b/, /(country|region|territory|city)/i],
    [/\b(status|stage|state)\b/, /(status|stage|state)/i],
    [/\b(product|sku|item|category)\b/, /(product|sku|category|name)/i],
    [/\b(machine|line|cell|plant)\b/, /(machine|line|cell|plant)/i],
    [/\b(channel|source)\b/, /(channel|source)/i],
  ];
  const joined = tokens.join(" ");
  for (const [inQuestion, inField] of hints) {
    if (inQuestion.test(joined)) {
      const match = categories.find((field) => inField.test(field.path) || inField.test(field.label));
      if (match) return match;
    }
  }
  return categories.find((field) => tokens.some((token) => field.path.toLowerCase().includes(token) || field.label.toLowerCase().includes(token)));
}

function pickDate(collection: CollectionProfile) {
  return collection.fields.find((field) => field.path === collection.primaryDateField) ??
    usable(collection).find((field) => field.role === "date");
}

function visualFor(group: FieldProfile | undefined, date: boolean, question: string): Visual {
  if (!group && !date) return "kpi";
  if (date) return "area";
  if (/\bby\b/i.test(question) && group && group.distinct > 3) {
    return group.distinct > 8 ? "bar" : "column";
  }
  if (group && group.distinct <= 6) return "donut";
  if (group && group.distinct > 8) return "bar";
  return "column";
}

function timeFilter(dateField: string, question: string): Filter | undefined {
  if (/\b(this year|ytd)\b/i.test(question)) {
    return { id: "f_time", field: dateField, operator: "in_last", value: 12, unit: "months" };
  }
  if (/\b(this month)\b/i.test(question)) {
    return { id: "f_time", field: dateField, operator: "in_last", value: 1, unit: "months" };
  }
  if (/\b(this week)\b/i.test(question)) {
    return { id: "f_time", field: dateField, operator: "in_last", value: 7, unit: "days" };
  }
  if (/\blast (\d+) days\b/i.test(question)) {
    const amount = Number(question.match(/\blast (\d+) days\b/i)?.[1] ?? 30);
    return { id: "f_time", field: dateField, operator: "in_last", value: amount, unit: "days" };
  }
  if (/\b(last month|past month)\b/i.test(question)) {
    return { id: "f_time", field: dateField, operator: "in_last", value: 1, unit: "months" };
  }
  return undefined;
}

function heuristicAsk(question: string, catalog: Catalog, sourceId: string, industry: Industry): AskResult | null {
  const tokens = question.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !["the", "our", "how", "many", "much", "what", "show", "me", "by", "over", "time", "this", "last", "year", "month"].includes(token));
  const collection = pickCollection(catalog, tokens, industry, question);
  if (!collection) return null;

  const wantsTrend = /\b(over time|trend|month by month|by month|this year|ytd)\b/i.test(question);
  const measure = pickMeasure(collection, tokens);
  const group = wantsTrend ? undefined : pickCategory(collection, tokens);
  const date = pickDate(collection);
  const countOnly =
    /\b(how many|number of|count)\b/i.test(question) &&
    !/\b(revenue|amount|value|total|yield|scrap|pipeline)\b/i.test(question);

  const metric = countOnly || !measure
    ? { id: "m_ask", agg: "count" as const, label: metricLabel("count", collection), format: "integer" as const }
    : {
        id: "m_ask",
        agg: defaultAggregation(measure),
        field: measure.path,
        label: metricLabel(defaultAggregation(measure), collection, measure),
        format: measure.format,
      };

  const filters: Filter[] = [];
  if (date) {
    const range = timeFilter(date.path, question);
    if (range) filters.push(range);
  }
  if (/\bopen\b/i.test(question)) {
    const stage = usable(collection).find((field) => /(stage|status)/i.test(field.path) && field.role === "category");
    if (stage) {
      filters.push({ id: "f_open", field: stage.path, operator: "not_contains", value: "Closed" });
    }
  }

  const groupBy: ReportSpec["groupBy"] = [];
  if (wantsTrend && date) {
    groupBy.push({ id: "g_ask", field: date.path, label: shortLabel(date.label), grain: "month" });
  } else if (group) {
    groupBy.push({ id: "g_ask", field: group.path, label: shortLabel(group.label), limit: 12 });
  }

  const visual = visualFor(group, Boolean(wantsTrend && date), question);
  const spec: ReportSpec = {
    sourceId,
    collection: collection.name,
    mode: "summary",
    metrics: [metric],
    groupBy,
    columns: [],
    filters,
    filterMatch: "all",
    limit: 36,
    visual,
    options: { ...OPTIONS, showLegend: visual !== "area" },
  };

  const title = groupBy.length
    ? `${metric.label} by ${groupBy[0].label.toLowerCase()}`
    : metric.label;
  return {
    spec,
    title,
    explanation: `Using ${collection.label}: ${metric.label}${groupBy[0] ? `, split by ${groupBy[0].label.toLowerCase()}` : ""}.`,
    usedModel: false,
  };
}

type ModelAsk = {
  collection: string;
  metricField?: string;
  metricAgg?: string;
  groupField?: string;
  grain?: string;
  visual?: string;
  title: string;
  explanation: string;
};

export async function askQuestion(
  question: string,
  catalog: Catalog,
  sourceId: string,
  industry: Industry,
): Promise<AskResult | null> {
  const modelled = await completeJson<ModelAsk>([
    {
      role: "system",
      content:
        "Turn a business question into a report against this MongoDB catalog. Return JSON { collection, metricField, metricAgg, groupField, grain, visual, title, explanation }. Use only names that exist. visual is kpi|bar|column|line|area|donut|table. grain is month when grouping by a date. If the question cannot be answered, return { collection: '' }.",
    },
    {
      role: "user",
      content: `Industry: ${industry}\nQuestion: ${question}\nCatalog:\n${catalog.collections
        .map((c) => `${c.name}: ${c.fields.filter((f) => !f.hidden).slice(0, 16).map((f) => f.path).join(", ")}`)
        .join("\n")}`,
    },
  ]);

  if (modelled?.collection) {
    const collection = catalog.collections.find((item) => item.name === modelled.collection);
    if (collection) {
      const field = modelled.metricField
        ? collection.fields.find((item) => item.path === modelled.metricField)
        : undefined;
      const group = modelled.groupField
        ? collection.fields.find((item) => item.path === modelled.groupField)
        : undefined;
      const visual = (["kpi", "bar", "column", "line", "area", "donut", "table"] as const).includes(
        modelled.visual as never,
      )
        ? (modelled.visual as Visual)
        : group
          ? "column"
          : "kpi";
      const spec: ReportSpec = {
        sourceId,
        collection: collection.name,
        mode: "summary",
        metrics: [
          field
            ? {
                id: "m_ask",
                agg: (["sum", "avg", "count", "min", "max", "median"] as const).includes(modelled.metricAgg as never)
                  ? (modelled.metricAgg as "sum")
                  : defaultAggregation(field),
                field: field.path,
                label: modelled.title,
                format: field.format,
              }
            : { id: "m_ask", agg: "count", label: modelled.title, format: "integer" },
        ],
        groupBy: group
          ? [{ id: "g_ask", field: group.path, label: group.label, grain: modelled.grain as "month" | undefined }]
          : [],
        columns: [],
        filters: [],
        filterMatch: "all",
        limit: 36,
        visual,
        options: OPTIONS,
      };
      return {
        spec,
        title: modelled.title,
        explanation: modelled.explanation,
        usedModel: true,
      };
    }
  }

  return heuristicAsk(question, catalog, sourceId, industry);
}
