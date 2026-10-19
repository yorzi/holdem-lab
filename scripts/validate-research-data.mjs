import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];

function readJson(relativePath) {
  const absolutePath = resolve(root, relativePath);

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireArray(value, path, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    errors.push(`${path} must be an array with at least ${minimum} item(s)`);
    return false;
  }

  return true;
}

function requireEnum(value, allowed, path) {
  if (!allowed.has(value)) {
    errors.push(`${path} must be one of: ${[...allowed].join(", ")}`);
  }
}

function requireDate(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${path} must use YYYY-MM-DD`);
  }
}

function requireHttpsUrl(value, path) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${path} must use https`);
    }
  } catch {
    errors.push(`${path} must be a valid URL`);
  }
}

function requireUniqueIds(items, path) {
  const ids = new Set();

  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    requireString(item?.id, `${itemPath}.id`);

    if (ids.has(item?.id)) {
      errors.push(`${itemPath}.id duplicates ${item.id}`);
    }
    ids.add(item?.id);
  }
}

function validateKnowledgeSources(data) {
  if (!data) return { count: 0 };

  if (data.schema_version !== 1) {
    errors.push("poker_knowledge_sources.json.schema_version must be 1");
  }
  requireDate(data.as_of, "poker_knowledge_sources.json.as_of");

  if (!requireArray(data.records, "poker_knowledge_sources.json.records", 12)) {
    return { count: 0 };
  }

  requireUniqueIds(data.records, "poker_knowledge_sources.json.records");

  const sourceTypes = new Set([
    "rules",
    "dataset",
    "specification",
    "software",
    "research",
    "responsible_learning",
    "platform_policy",
  ]);
  const authorityTiers = new Set([
    "A_primary",
    "B_peer_reviewed",
    "C_industry_primary",
    "D_community_signal",
  ]);
  const rightsStatuses = new Set([
    "all_rights_reserved",
    "cc_by_4_0",
    "cc_by_3_0",
    "mit",
    "apache_2_0",
    "agpl_3_0_or_later",
    "mixed_requires_review",
    "unknown",
  ]);
  const usageStatuses = new Set([
    "link_and_cite",
    "candidate_import",
    "cross_check_only",
    "research_only",
    "do_not_copy",
  ]);

  for (const [index, record] of data.records.entries()) {
    const path = `poker_knowledge_sources.json.records[${index}]`;
    requireString(record.title, `${path}.title`);
    requireString(record.publisher, `${path}.publisher`);
    requireHttpsUrl(record.url, `${path}.url`);
    requireEnum(record.source_type, sourceTypes, `${path}.source_type`);
    requireEnum(record.authority_tier, authorityTiers, `${path}.authority_tier`);
    requireEnum(record.rights_status, rightsStatuses, `${path}.rights_status`);
    requireEnum(record.usage_status, usageStatuses, `${path}.usage_status`);
    requireString(record.scope, `${path}.scope`);
    requireArray(record.supports, `${path}.supports`);
    requireArray(record.does_not_support, `${path}.does_not_support`);
    requireArray(record.product_uses, `${path}.product_uses`);
    requireString(record.version, `${path}.version`);
    requireDate(record.last_verified, `${path}.last_verified`);
    requireString(record.notes, `${path}.notes`);

    if (!record.fingerprint || typeof record.fingerprint !== "object") {
      errors.push(`${path}.fingerprint must be an object`);
      continue;
    }

    requireEnum(
      record.fingerprint.status,
      new Set(["not_captured", "captured"]),
      `${path}.fingerprint.status`,
    );

    if (record.fingerprint.status === "captured") {
      if (
        typeof record.fingerprint.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(record.fingerprint.sha256)
      ) {
        errors.push(`${path}.fingerprint.sha256 must be a lowercase SHA-256 digest`);
      }
    } else if (record.fingerprint.sha256 !== null) {
      errors.push(`${path}.fingerprint.sha256 must be null until captured`);
    }
  }

  return { count: data.records.length };
}

function validatePricing(snapshot, path) {
  if (!snapshot || typeof snapshot !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  requireEnum(
    snapshot.status,
    new Set(["current", "partial", "not_observed", "prelaunch"]),
    `${path}.status`,
  );
  requireDate(snapshot.as_of, `${path}.as_of`);

  if (!Array.isArray(snapshot.plans)) {
    errors.push(`${path}.plans must be an array`);
    return;
  }

  if (["current", "partial", "prelaunch"].includes(snapshot.status) && snapshot.plans.length === 0) {
    errors.push(`${path}.plans cannot be empty for status ${snapshot.status}`);
  }

  const intervals = new Set([
    "free",
    "first_month",
    "month",
    "week",
    "year",
    "six_months",
    "lifetime",
  ]);

  for (const [index, plan] of snapshot.plans.entries()) {
    const planPath = `${path}.plans[${index}]`;
    requireString(plan.name, `${planPath}.name`);
    if (typeof plan.amount !== "number" || !Number.isFinite(plan.amount) || plan.amount < 0) {
      errors.push(`${planPath}.amount must be a non-negative finite number`);
    }
    if (typeof plan.currency !== "string" || !/^[A-Z]{3}$/.test(plan.currency)) {
      errors.push(`${planPath}.currency must be a three-letter uppercase code`);
    }
    requireEnum(plan.interval, intervals, `${planPath}.interval`);
    requireString(plan.note, `${planPath}.note`);
  }
}

function validateProductResearch(data) {
  if (!data) return { directCount: 0, analogueCount: 0 };

  if (data.schema_version !== 1) {
    errors.push("poker_training_products.json.schema_version must be 1");
  }
  requireDate(data.as_of, "poker_training_products.json.as_of");
  requireString(data.caveat, "poker_training_products.json.caveat");

  if (!requireArray(data.direct_competitors, "poker_training_products.json.direct_competitors", 10)) {
    return { directCount: 0, analogueCount: 0 };
  }
  if (!requireArray(data.learning_analogues, "poker_training_products.json.learning_analogues", 3)) {
    return { directCount: data.direct_competitors.length, analogueCount: 0 };
  }

  requireUniqueIds(data.direct_competitors, "poker_training_products.json.direct_competitors");
  requireUniqueIds(data.learning_analogues, "poker_training_products.json.learning_analogues");

  for (const [index, product] of data.direct_competitors.entries()) {
    const path = `poker_training_products.json.direct_competitors[${index}]`;
    requireString(product.name, `${path}.name`);
    requireHttpsUrl(product.official_url, `${path}.official_url`);
    requireString(product.segment, `${path}.segment`);
    requireString(product.stage, `${path}.stage`);
    requireArray(product.primary_audience, `${path}.primary_audience`);
    requireString(product.business_model, `${path}.business_model`);
    validatePricing(product.pricing_snapshot, `${path}.pricing_snapshot`);
    requireString(product.core_loop, `${path}.core_loop`);
    requireArray(product.key_capabilities, `${path}.key_capabilities`);
    requireString(product.solver_or_ai_claim, `${path}.solver_or_ai_claim`);
    requireString(product.real_money_relationship, `${path}.real_money_relationship`);
    requireArray(product.strengths, `${path}.strengths`);
    requireArray(product.strategic_observations, `${path}.strategic_observations`);
    if (requireArray(product.source_urls, `${path}.source_urls`)) {
      product.source_urls.forEach((url, urlIndex) =>
        requireHttpsUrl(url, `${path}.source_urls[${urlIndex}]`),
      );
    }
    requireDate(product.last_verified, `${path}.last_verified`);
  }

  for (const [index, product] of data.learning_analogues.entries()) {
    const path = `poker_training_products.json.learning_analogues[${index}]`;
    requireString(product.name, `${path}.name`);
    requireHttpsUrl(product.official_url, `${path}.official_url`);
    requireString(product.category, `${path}.category`);
    requireArray(product.mechanics, `${path}.mechanics`);
    requireArray(product.product_lessons, `${path}.product_lessons`);
    requireArray(product.avoid_copying, `${path}.avoid_copying`);
    if (requireArray(product.source_urls, `${path}.source_urls`)) {
      product.source_urls.forEach((url, urlIndex) =>
        requireHttpsUrl(url, `${path}.source_urls[${urlIndex}]`),
      );
    }
    requireDate(product.last_verified, `${path}.last_verified`);
  }

  return {
    directCount: data.direct_competitors.length,
    analogueCount: data.learning_analogues.length,
  };
}

const knowledge = readJson("data/research/poker_knowledge_sources.json");
const products = readJson("data/research/poker_training_products.json");
const knowledgeSummary = validateKnowledgeSources(knowledge);
const productSummary = validateProductResearch(products);

if (knowledge?.as_of && products?.as_of && knowledge.as_of !== products.as_of) {
  errors.push("research registries must use the same as_of date");
}

if (errors.length > 0) {
  console.error(`Research data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Research data valid: ${knowledgeSummary.count} knowledge sources, ` +
    `${productSummary.directCount} direct competitors, ` +
    `${productSummary.analogueCount} learning analogues.`,
);
