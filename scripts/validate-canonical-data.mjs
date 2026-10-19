import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];
const publicationStatuses = new Set(["draft", "review_preview", "published", "retired"]);
const rightsStatuses = new Set(["original_authored", "reference_only", "rights_review_required", "unknown", "restricted"]);
const integrityStatuses = new Set(["verified", "not_captured", "failed"]);
const reviewStatuses = new Set(["pending", "approved", "rejected"]);
const technicalReviewStatuses = new Set(["pending", "passed", "rejected"]);

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
}

function requireNullableString(value, path) {
  if (value !== null) requireString(value, path);
}

function requireId(value, path) {
  requireString(value, path);
  if (typeof value === "string" && !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value)) {
    errors.push(`${path} must be a stable lowercase id`);
  }
}

function requireArray(value, path, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    errors.push(`${path} must contain at least ${minimum} item(s)`);
    return false;
  }
  return true;
}

function requireEnum(value, allowed, path) {
  if (!allowed.has(value)) errors.push(`${path} must be one of: ${[...allowed].join(", ")}`);
}

function requireReview(review, path) {
  if (!review || typeof review !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  requireEnum(review.status, reviewStatuses, `${path}.status`);
  if (review.status === "approved") {
    requireString(review.reviewer, `${path}.reviewer`);
    requireString(review.reviewed_at, `${path}.reviewed_at`);
  } else if (review.reviewer !== null || review.reviewed_at !== null) {
    errors.push(`${path} non-approved review must keep reviewer and reviewed_at null`);
  }
}

function requireTechnicalReview(review, path) {
  if (!review || typeof review !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  requireEnum(review.status, technicalReviewStatuses, `${path}.status`);
  if (requireArray(review.evidence, `${path}.evidence`)) {
    review.evidence.forEach((evidence, index) => requireString(evidence, `${path}.evidence[${index}]`));
  }
}

function requireCommonGate(record, path) {
  requireEnum(record.rights_status, rightsStatuses, `${path}.rights_status`);
  requireEnum(record.integrity_status, integrityStatuses, `${path}.integrity_status`);
  requireEnum(record.publication_status, publicationStatuses, `${path}.publication_status`);
  requireTechnicalReview(record.technical_review, `${path}.technical_review`);
  requireReview(record.domain_review, `${path}.domain_review`);

  if (record.integrity_status === "failed") errors.push(`${path}.integrity_status cannot be failed in a canonical registry`);
  if (record.publication_status === "published" && (
    record.rights_status !== "original_authored" && record.rights_status !== "reference_only" ||
    record.integrity_status !== "verified" ||
    record.technical_review?.status !== "passed" ||
    record.domain_review?.status !== "approved"
  )) {
    errors.push(`${path} cannot be published before rights, integrity, technical, and domain gates pass`);
  }
}

function requirePathDigest(pathValue, digestValue, path) {
  requireString(pathValue, `${path}.asset_path`);
  if (typeof digestValue !== "string" || !/^[a-f0-9]{64}$/.test(digestValue)) {
    errors.push(`${path}.asset_sha256 must be a lowercase SHA-256 digest`);
    return;
  }
  if (!existsSync(resolve(root, pathValue))) {
    errors.push(`${path}.asset_path does not exist: ${pathValue}`);
    return;
  }
  const actual = createHash("sha256").update(readFileSync(resolve(root, pathValue))).digest("hex");
  if (actual !== digestValue) errors.push(`${path}.asset_sha256 does not match ${pathValue}`);
}

function indexRecords(records, path, key) {
  const index = new Map();
  if (!Array.isArray(records)) {
    errors.push(`${path} must be an array`);
    return index;
  }

  records.forEach((record, position) => {
    const recordPath = `${path}[${position}]`;
    if (!record || typeof record !== "object") {
      errors.push(`${recordPath} must be an object`);
      return;
    }
    const id = record[key];
    requireId(id, `${recordPath}.${key}`);
    if (index.has(id)) errors.push(`${recordPath}.${key} duplicates ${id}`);
    index.set(id, record);
  });
  return index;
}

function requireReferences(ids, index, path, minimum = 0) {
  if (!requireArray(ids, path, minimum)) return;
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) errors.push(`${path} must contain unique ids`);
  ids.forEach((id, position) => {
    requireId(id, `${path}[${position}]`);
    if (!index.has(id)) errors.push(`${path}[${position}] references unknown id ${id}`);
  });
}

function loadLayer(index, layerId) {
  const layer = (index.layers ?? []).find((candidate) => candidate.id === layerId);
  if (!layer) {
    errors.push(`canonical index is missing layer ${layerId}`);
    return { records: [], definition: null };
  }

  requireString(layer.path, `canonical index layer ${layerId}.path`);
  requireString(layer.record_key, `canonical index layer ${layerId}.record_key`);
  const data = layer.path ? readJson(layer.path) : null;
  if (!data) return { records: [], definition: layer };
  if (data.schema_version !== 1) errors.push(`${layer.path}.schema_version must be 1`);
  requireString(data.registry_id, `${layer.path}.registry_id`);
  if (data.layer !== layerId) errors.push(`${layer.path}.layer must be ${layerId}`);
  if (data.technical_status !== "automated_pass_required") errors.push(`${layer.path}.technical_status must be automated_pass_required`);
  if (!Array.isArray(data.records)) errors.push(`${layer.path}.records must be an array`);
  return { records: Array.isArray(data.records) ? data.records : [], definition: layer };
}

const canonicalIndex = readJson("data/content/canonical-content-v1.json");
const catalog = readJson("data/content/curriculum-v1.json");
const research = readJson("data/research/poker_knowledge_sources.json");
const exercises = loadLayer(canonicalIndex ?? {}, "exercises");
const sources = loadLayer(canonicalIndex ?? {}, "sources");
const sourceReferences = loadLayer(canonicalIndex ?? {}, "source_references");
const strategy = loadLayer(canonicalIndex ?? {}, "strategy");

if (canonicalIndex) {
  if (canonicalIndex.schema_version !== 1) errors.push("data/content/canonical-content-v1.json.schema_version must be 1");
  requireId(canonicalIndex.contract_id, "data/content/canonical-content-v1.json.contract_id");
  if (canonicalIndex.technical_status !== "automated_pass_required") errors.push("canonical content technical_status must be automated_pass_required");
  requireArray(canonicalIndex.publication_policy?.required_status_fields, "canonical publication required_status_fields", 4);
  requireArray(canonicalIndex.layers, "canonical layers", 4);
}

const catalogExercises = indexRecords(catalog?.exercises, "data/content/curriculum-v1.json.exercises", "id");
const catalogSourceReferences = catalog?.source_references ?? [];
const researchRecords = indexRecords(research?.records, "data/research/poker_knowledge_sources.json.records", "id");
const sourceRecords = indexRecords(sources.records, "data/sources/source-registry-v1.json.records", "source_id");
const sourceReferenceRecords = indexRecords(
  sourceReferences.records,
  "data/sources/source-reference-registry-v1.json.records",
  "source_reference_id"
);
const sourcePacketIds = new Set(["position-v1", "pot-odds-v1", "decision-quality-v1"]);

for (const [index, template] of exercises.records.entries()) {
  const path = `data/exercises/exercise-templates-v1.json.records[${index}]`;
  requireCommonGate(template, path);
  requireEnum(template.exercise_type, new Set(["single_choice_retrieval"]), `${path}.exercise_type`);
  requireEnum(template.answer_contract, new Set([
    "rules_fact",
    "arithmetic_result",
    "instructional_boundary",
    "modeling_boundary",
    "outcome_boundary",
    "calibration_signal",
    "review_order"
  ]), `${path}.answer_contract`);
  requireString(template.generator_version, `${path}.generator_version`);
  requireReferences(template.required_fields, new Map([
    ["lesson_slug", true],
    ["dom_id", true],
    ["concept_id", true],
    ["view_answer_value", true],
    ["source_reference_ids", true]
  ]), `${path}.required_fields`);
  requireArray(template.coverage_tags, `${path}.coverage_tags`);
  requireReferences(template.catalog_exercise_ids, catalogExercises, `${path}.catalog_exercise_ids`);
}

const templatesByExerciseId = new Map();
for (const template of exercises.records) {
  for (const catalogExerciseId of template.catalog_exercise_ids ?? []) {
    if (templatesByExerciseId.has(catalogExerciseId)) {
      errors.push(`catalog exercise ${catalogExerciseId} is assigned to multiple canonical exercise templates`);
    }
    templatesByExerciseId.set(catalogExerciseId, template);
  }
}

for (const [id, exercise] of catalogExercises.entries()) {
  const template = templatesByExerciseId.get(id);
  if (!template) {
    errors.push(`catalog exercise ${id} has no canonical exercise template`);
  } else {
    if (Object.hasOwn(exercise, "exercise_type") || Object.hasOwn(exercise, "answer_contract")) {
      errors.push(`catalog exercise ${id} must not duplicate the canonical exercise contract`);
    }
  }
}

for (const [index, source] of sources.records.entries()) {
  const path = `data/sources/source-registry-v1.json.records[${index}]`;
  requireCommonGate(source, path);
  requireEnum(source.source_kind, new Set(["external_source", "quality_packet", "quality_fixture", "internal_contract"]), `${path}.source_kind`);
  requireArray(source.source_packet_ids, `${path}.source_packet_ids`, 0);
  requireNullableString(source.research_id, `${path}.research_id`);
  for (const [packetIndex, packetId] of (source.source_packet_ids ?? []).entries()) {
    if (!sourcePacketIds.has(packetId)) errors.push(`${path}.source_packet_ids[${packetIndex}] references an unknown quality packet ${packetId}`);
  }

  if (source.source_kind === "external_source") {
    if (!source.research_id || !researchRecords.has(source.research_id)) {
      errors.push(`${path}.research_id must reference the research registry`);
    } else {
      const researchRecord = researchRecords.get(source.research_id);
      if (source.research_rights_status !== researchRecord.rights_status) errors.push(`${path}.research_rights_status must mirror research rights_status`);
      if (source.usage_status !== researchRecord.usage_status) errors.push(`${path}.usage_status must mirror research usage_status`);
    }
    if (source.integrity_status !== "not_captured") errors.push(`${path} external sources must remain not_captured until an exact asset is fixed`);
    if (source.asset_path !== null || source.asset_sha256 !== null) errors.push(`${path} external source assets must not be silently downloaded`);
  } else {
    if (source.research_id !== null) errors.push(`${path}.research_id must be null for internal records`);
    if (source.integrity_status !== "verified") errors.push(`${path} internal records must have verified integrity`);
    requirePathDigest(source.asset_path, source.asset_sha256, path);
  }
}

for (const [index, reference] of sourceReferenceRecords.entries()) {
  const path = `data/sources/source-reference-registry-v1.json.records[${index}]`;
  requireCommonGate(reference, path);
  requireString(reference.kind, `${path}.kind`);
  requireString(reference.source_packet_id, `${path}.source_packet_id`);
  requireString(reference.claim_id, `${path}.claim_id`);
  requireArray(reference.source_ids, `${path}.source_ids`, 0);
  if (!sourcePacketIds.has(reference.source_packet_id)) {
    errors.push(`${path}.source_packet_id references an unknown quality packet`);
  }

  const packetPath = `data/quality/source_packets/${reference.source_packet_id}.json`;
  const packet = readJson(packetPath);
  const claim = packet?.claims?.find((candidate) => candidate.id === reference.claim_id);
  if (!claim) {
    errors.push(`${path} references missing claim ${reference.claim_id}`);
  } else {
    for (const [sourceIndex, sourceId] of (reference.source_ids ?? []).entries()) {
      if (!sourceRecords.has(sourceId)) errors.push(`${path}.source_ids[${sourceIndex}] references unknown canonical source ${sourceId}`);
      if (!claim.source_ids.includes(sourceId)) errors.push(`${path}.source_ids[${sourceIndex}] is absent from claim ${reference.claim_id}`);
    }
  }
}

for (const [index, reference] of catalogSourceReferences.entries()) {
  const path = `data/content/curriculum-v1.json.source_references[${index}]`;
  const keys = Object.keys(reference);
  if (keys.some((key) => key !== "id")) errors.push(`${path} must keep provenance fields in the canonical source-reference registry`);
  if (!sourceReferenceRecords.has(reference.id)) {
    errors.push(`${path}.id references unknown canonical source reference ${reference.id}`);
  }
}

for (const [index, reference] of sourceReferenceRecords.entries()) {
  for (const [sourceIndex, sourceId] of (reference.source_ids ?? []).entries()) {
    if (!sourceRecords.has(sourceId)) errors.push(`canonical source reference ${index}.source_ids[${sourceIndex}] references unknown canonical source ${sourceId}`);
  }
}

for (const [index, lesson] of (catalog?.lessons ?? []).entries()) {
  for (const [packetIndex, packetId] of (lesson.source_packet_ids ?? []).entries()) {
    const packetSource = sources.records.find((source) => source.source_packet_ids?.includes(packetId));
    if (!packetSource) errors.push(`catalog lesson ${index}.source_packet_ids[${packetIndex}] has no canonical source registry record`);
  }
}

for (const packetId of ["position-v1", "pot-odds-v1", "decision-quality-v1"]) {
  const packetPath = `data/quality/source_packets/${packetId}.json`;
  const packet = readJson(packetPath);
  for (const [claimIndex, claim] of (packet?.claims ?? []).entries()) {
    for (const [sourceIndex, sourceId] of (claim.source_ids ?? []).entries()) {
      if (!sourceRecords.has(sourceId)) errors.push(`${packetPath}.claims[${claimIndex}].source_ids[${sourceIndex}] references unknown canonical source ${sourceId}`);
    }
  }
}

const golden = readJson("data/quality/holdem-golden-v2.json");
for (const [index, sourceId] of (golden?.internal_source_ids ?? []).entries()) {
  if (!sourceRecords.has(sourceId)) errors.push(`data/quality/holdem-golden-v2.json.internal_source_ids[${index}] references unknown canonical source ${sourceId}`);
}
for (const [index, scenario] of (golden?.scenarios ?? []).entries()) {
  for (const [sourceIndex, sourceId] of (scenario.source_ids ?? []).entries()) {
    if (!sourceRecords.has(sourceId)) errors.push(`data/quality/holdem-golden-v2.json.scenarios[${index}].source_ids[${sourceIndex}] references unknown canonical source ${sourceId}`);
  }
}

for (const [index, baseline] of strategy.records.entries()) {
  const path = `data/strategy/strategy-registry-v1.json.records[${index}]`;
  requireCommonGate(baseline, path);
  requireEnum(baseline.evidence_label, new Set(["benchmark_strategy", "approximate_analysis", "solver_data"]), `${path}.evidence_label`);
  requireEnum(baseline.strategy_kind, new Set(["teaching_baseline", "transparent_heuristic", "solver_pack"]), `${path}.strategy_kind`);
  requireEnum(baseline.runtime_status, new Set(["local_practice_only", "internal_review", "published"]), `${path}.runtime_status`);
  requireString(baseline.method, `${path}.method`);
  requireArray(baseline.assumptions, `${path}.assumptions`);
  requireArray(baseline.supported_claim_codes, `${path}.supported_claim_codes`);
  requireArray(baseline.unsupported_claim_codes, `${path}.unsupported_claim_codes`);
  requireReferences(baseline.source_ids, sourceRecords, `${path}.source_ids`);
  requirePathDigest(baseline.runtime_path, baseline.runtime_digest, path.replace(".records", ".runtime"));

  if (baseline.evidence_label === "approximate_analysis" && !baseline.unsupported_claim_codes.includes("solver_data")) {
    errors.push(`${path}.unsupported_claim_codes must include solver_data for approximate_analysis`);
  }
  if (baseline.evidence_label === "solver_data") {
    if (!baseline.solver_provenance || typeof baseline.solver_provenance !== "object") {
      errors.push(`${path}.solver_provenance is required for solver_data`);
    }
    if (baseline.runtime_status === "published" && baseline.domain_review?.status !== "approved") {
      errors.push(`${path} solver_data cannot be published without domain review`);
    }
  } else if (baseline.solver_provenance !== undefined && baseline.solver_provenance !== null) {
    errors.push(`${path}.solver_provenance must be absent for non-solver evidence`);
  }
  if (baseline.runtime_status === "published" && baseline.publication_status !== "published") {
    errors.push(`${path}.runtime_status published requires publication_status published`);
  }
}

if (errors.length > 0) {
  console.error(`Canonical data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Canonical data validation passed: ${exercises.records.length} exercise templates, ${sourceRecords.size} sources, ${sourceReferenceRecords.size} source references, ${strategy.records.length} strategy records; no solver data is published.`);
