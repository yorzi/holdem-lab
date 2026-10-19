import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];
const packetPaths = [
  "data/quality/source_packets/position-v1.json",
  "data/quality/source_packets/pot-odds-v1.json",
  "data/quality/source_packets/decision-quality-v1.json",
];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
}

function requireArray(value, path, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    errors.push(`${path} must contain at least ${minimum} item(s)`);
    return false;
  }
  return true;
}

function requireUniqueIds(items, path) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    requireString(item?.id, `${path}[${index}].id`);
    if (ids.has(item?.id)) errors.push(`${path}[${index}].id duplicates ${item.id}`);
    ids.add(item?.id);
  }
}

const research = readJson("data/research/poker_knowledge_sources.json");
const researchIds = new Set(research?.records?.map((record) => record.id) ?? []);
const packets = packetPaths.map((path) => ({ path, data: readJson(path) }));
const packetIds = new Set(packets.map(({ data }) => data?.id).filter(Boolean));

for (const { path, data } of packets) {
  if (!data) continue;
  if (data.schema_version !== 1) errors.push(`${path}.schema_version must be 1`);
  requireString(data.id, `${path}.id`);
  requireString(data.lesson_slug, `${path}.lesson_slug`);
  if (data.locale !== "en") errors.push(`${path}.locale must be en for the default content layer`);
  requireString(data.content_version, `${path}.content_version`);
  if (!["draft", "review_preview", "published"].includes(data.publication_status)) errors.push(`${path}.publication_status is invalid`);
  if (data.technical_review?.status !== "passed") errors.push(`${path}.technical_review.status must be passed before the packet is used`);
  requireArray(data.technical_review?.evidence, `${path}.technical_review.evidence`);
  if (!["pending", "approved", "rejected"].includes(data.domain_review?.status)) errors.push(`${path}.domain_review.status is invalid`);
  if (data.domain_review?.status === "approved" && (!data.domain_review.reviewer || !data.domain_review.reviewed_at)) errors.push(`${path} approved domain review requires reviewer and reviewed_at`);
  if (data.publication_status === "published" && data.domain_review?.status !== "approved") errors.push(`${path} cannot be published before independent domain approval`);

  if (requireArray(data.claims, `${path}.claims`)) {
    requireUniqueIds(data.claims, `${path}.claims`);
    for (const [index, claim] of data.claims.entries()) {
      const claimPath = `${path}.claims[${index}]`;
      requireString(claim.text, `${claimPath}.text`);
      requireString(claim.claim_type, `${claimPath}.claim_type`);
      if (!Array.isArray(claim.source_ids)) errors.push(`${claimPath}.source_ids must be an array`);
      if (!Array.isArray(claim.internal_evidence)) errors.push(`${claimPath}.internal_evidence must be an array`);
      if ((claim.source_ids?.length ?? 0) + (claim.internal_evidence?.length ?? 0) === 0) errors.push(`${claimPath} needs source_ids or internal_evidence`);
      for (const sourceId of claim.source_ids ?? []) {
        if (!researchIds.has(sourceId)) errors.push(`${claimPath}.source_ids references unknown research source ${sourceId}`);
      }
      requireArray(claim.limitations, `${claimPath}.limitations`);
    }
  }

  requireString(data.rights?.content_mode, `${path}.rights.content_mode`);
  requireString(data.rights?.source_reproduction, `${path}.rights.source_reproduction`);
  requireString(data.rights?.allowed_product_use, `${path}.rights.allowed_product_use`);
}

const goldenPath = "data/quality/holdem-golden-v2.json";
const golden = readJson(goldenPath);
if (golden) {
  if (golden.schema_version !== 1) errors.push(`${goldenPath}.schema_version must be 1`);
  if (golden.rules_version !== "holdem-rules-v2") errors.push(`${goldenPath}.rules_version must be holdem-rules-v2`);
  if (golden.evaluator_version !== "holdem-evaluator-v1") errors.push(`${goldenPath}.evaluator_version must be holdem-evaluator-v1`);
  if (golden.rng_version !== "mulberry32-fisher-yates-v1") errors.push(`${goldenPath}.rng_version is invalid`);
  if (golden.domain_review?.status !== "pending" && (!golden.domain_review?.reviewer || !golden.domain_review?.reviewed_at)) errors.push(`${goldenPath} non-pending domain review requires reviewer evidence`);
  if (!Array.isArray(golden.scenarios) || golden.scenarios.length < 20 || golden.scenarios.length > 30) errors.push(`${goldenPath}.scenarios must contain 20–30 cases`);
  if (Array.isArray(golden.scenarios)) {
    requireUniqueIds(golden.scenarios, `${goldenPath}.scenarios`);
    const allowedKinds = new Set(["initial_deal", "state_versions", "initial_actor", "initial_chips", "initial_legal", "trace", "invalid_action", "five_card_rank", "best_hand_rank", "pot_odds", "replay_rejection"]);
    const allowedSources = new Set([...researchIds, ...(golden.internal_source_ids ?? [])]);
    for (const [index, scenario] of golden.scenarios.entries()) {
      if (!allowedKinds.has(scenario.kind)) errors.push(`${goldenPath}.scenarios[${index}].kind is invalid`);
      if (requireArray(scenario.source_ids, `${goldenPath}.scenarios[${index}].source_ids`)) {
        for (const sourceId of scenario.source_ids) {
          if (!allowedSources.has(sourceId)) errors.push(`${goldenPath}.scenarios[${index}] references unknown source ${sourceId}`);
        }
      }
    }
  }
  for (const packetId of golden.source_packet_ids ?? []) {
    if (!packetIds.has(packetId)) errors.push(`${goldenPath}.source_packet_ids references unknown packet ${packetId}`);
  }

  for (const packetId of packetIds) {
    if (!(golden.source_packet_ids ?? []).includes(packetId)) errors.push(`${goldenPath}.source_packet_ids is missing packet ${packetId}`);
  }

  const technicalEvidenceIds = new Set([
    ...(golden.internal_source_ids ?? []),
    ...(golden.scenarios ?? []).map((scenario) => scenario.id),
  ]);
  for (const { path, data } of packets) {
    for (const evidenceId of data?.technical_review?.evidence ?? []) {
      if (!technicalEvidenceIds.has(evidenceId)) errors.push(`${path}.technical_review.evidence references unknown evidence ${evidenceId}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Quality data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Quality data validation passed: ${packets.length} source packets, ${golden.scenarios.length} golden scenarios, domain review ${golden.domain_review.status}.`);
