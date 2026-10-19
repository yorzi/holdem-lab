import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const catalogPath = "data/content/curriculum-v1.json";
const manifestPath = "data/content/lesson-manifest-v1.json";
const errors = [];

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

function requireId(value, path) {
  requireString(value, path);
  if (typeof value === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    errors.push(`${path} must be a stable lowercase kebab-case id`);
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

  requireEnum(review.status, new Set(["pending", "approved", "rejected"]), `${path}.status`);
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

  requireEnum(review.status, new Set(["pending", "passed", "rejected"]), `${path}.status`);
  if (requireArray(review.evidence, `${path}.evidence`)) {
    review.evidence.forEach((evidence, index) => requireString(evidence, `${path}.evidence[${index}]`));
  }
}

function indexRecords(records, path, label) {
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
    requireId(record.id, `${recordPath}.id`);
    if (index.has(record.id)) errors.push(`${recordPath}.id duplicates ${label} ${record.id}`);
    index.set(record.id, record);
  });
  return index;
}

function requireReferenceIds(ids, index, path) {
  if (!requireArray(ids, path)) return;
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) errors.push(`${path} must contain unique ids`);
  ids.forEach((id, position) => {
    requireId(id, `${path}[${position}]`);
    if (!index.has(id)) errors.push(`${path}[${position}] references unknown id ${id}`);
  });
}

function requirePublicationGate(record, path, technicalReviewPath = null) {
  const publicationStatuses = new Set(["draft", "review_preview", "published", "retired"]);
  const rightsStatuses = new Set(["original_authored", "reference_only", "rights_review_required", "unknown", "restricted"]);
  requireEnum(record.publication_status, publicationStatuses, `${path}.publication_status`);
  requireEnum(record.rights_status, rightsStatuses, `${path}.rights_status`);
  requireReview(record.domain_review, `${path}.domain_review`);

  if (technicalReviewPath) requireTechnicalReview(record.technical_review, technicalReviewPath);

  if (record.publication_status === "published" && (
    !["original_authored", "reference_only"].includes(record.rights_status) ||
    record.domain_review?.status !== "approved" ||
    (technicalReviewPath && record.technical_review?.status !== "passed")
  )) {
    errors.push(`${path} cannot be published before rights, domain, and technical gates pass`);
  }
}

function verifyExerciseInView(exercise, manifestById, path) {
  const lesson = manifestById.get(`lesson-${exercise.lesson_slug}-en-v1`);
  const zhLesson = manifestById.get(`lesson-${exercise.lesson_slug}-zh-v1`);
  if (!lesson || !zhLesson) return;

  for (const asset of [lesson, zhLesson]) {
    const viewPath = resolve(root, asset.view_path);
    if (!existsSync(viewPath)) {
      errors.push(`${path} cannot inspect missing view ${asset.view_path}`);
      continue;
    }
    const view = readFileSync(viewPath, "utf8");
    if (!view.includes(`id="${exercise.dom_id}"`)) {
      errors.push(`${path}.dom_id ${exercise.dom_id} is missing from ${asset.view_path}`);
    }
    if (!view.includes(`data-answer="${exercise.view_answer_value}"`)) {
      errors.push(`${path}.view_answer_value ${exercise.view_answer_value} is missing from ${asset.view_path}`);
    }
  }
}

const catalog = readJson(catalogPath);
const manifest = readJson(manifestPath);
if (!catalog || !manifest) process.exit(1);

if (catalog.schema_version !== 1) errors.push(`${catalogPath}.schema_version must be 1`);
if (catalog.catalog_id !== "holdem-curriculum-v1") errors.push(`${catalogPath}.catalog_id must be holdem-curriculum-v1`);
if (catalog.technical_status !== "automated_pass_required") errors.push(`${catalogPath}.technical_status must be automated_pass_required`);

const lessons = Array.isArray(catalog.lessons) ? catalog.lessons : [];
const concepts = Array.isArray(catalog.concepts) ? catalog.concepts : [];
const exercises = Array.isArray(catalog.exercises) ? catalog.exercises : [];
const sourceReferences = Array.isArray(catalog.source_references) ? catalog.source_references : [];
const lessonsById = indexRecords(lessons, `${catalogPath}.lessons`, "lesson");
const conceptsById = indexRecords(concepts, `${catalogPath}.concepts`, "concept");
const exercisesById = indexRecords(exercises, `${catalogPath}.exercises`, "exercise");
const referencesById = indexRecords(sourceReferences, `${catalogPath}.source_references`, "source reference");
const manifestById = new Map((manifest.records ?? []).map((record) => [record.id, record]));
const sourcePackets = new Map();
const exercisesByLesson = new Map();
const usedConceptIds = new Set();
const usedReferenceIds = new Set();

if (lessons.length === 0) errors.push(`${catalogPath}.lessons must not be empty`);
if (concepts.length === 0) errors.push(`${catalogPath}.concepts must not be empty`);
if (exercises.length === 0) errors.push(`${catalogPath}.exercises must not be empty`);
if (sourceReferences.length === 0) errors.push(`${catalogPath}.source_references must not be empty`);

for (const [index, lesson] of lessons.entries()) {
  const path = `${catalogPath}.lessons[${index}]`;
  requireString(lesson.slug, `${path}.slug`);
  if (!Number.isInteger(lesson.sequence) || lesson.sequence < 1) errors.push(`${path}.sequence must be a positive integer`);
  requireString(lesson.content_version, `${path}.content_version`);
  requirePublicationGate(lesson, path, `${path}.technical_review`);
  requireReferenceIds(lesson.asset_ids, manifestById, `${path}.asset_ids`);
  requireReferenceIds(lesson.concept_ids, conceptsById, `${path}.concept_ids`);
  requireReferenceIds(lesson.exercise_ids, exercisesById, `${path}.exercise_ids`);
  requireReferenceIds(lesson.source_reference_ids, referencesById, `${path}.source_reference_ids`);

  for (const assetId of lesson.asset_ids ?? []) {
    const asset = manifestById.get(assetId);
    if (asset && asset.slug !== lesson.slug) errors.push(`${path}.asset_ids references ${assetId} with slug ${asset.slug}`);
  }
  for (const packetId of lesson.source_packet_ids ?? []) {
    const packetPath = `data/quality/source_packets/${packetId}.json`;
    const packet = sourcePackets.has(packetId) ? sourcePackets.get(packetId) : readJson(packetPath);
    sourcePackets.set(packetId, packet);
    if (packet && packet.lesson_slug !== lesson.slug) errors.push(`${path}.source_packet_ids references ${packetId} with slug ${packet.lesson_slug}`);
  }
  if (!Array.isArray(lesson.source_packet_ids) || lesson.source_packet_ids.length === 0) {
    errors.push(`${path}.source_packet_ids must contain at least one packet`);
  }
  for (const conceptId of lesson.concept_ids ?? []) usedConceptIds.add(conceptId);
  for (const referenceId of lesson.source_reference_ids ?? []) usedReferenceIds.add(referenceId);
}

for (const [index, concept] of concepts.entries()) {
  const path = `${catalogPath}.concepts[${index}]`;
  requireString(concept.slug, `${path}.slug`);
  requireString(concept.lesson_slug, `${path}.lesson_slug`);
  if (!lessons.some((lesson) => lesson.slug === concept.lesson_slug)) errors.push(`${path}.lesson_slug references an unknown lesson`);
  requireArray(concept.prerequisite_ids, `${path}.prerequisite_ids`, 0);
  for (const prerequisiteId of concept.prerequisite_ids ?? []) {
    if (prerequisiteId === concept.id) errors.push(`${path}.prerequisite_ids cannot reference itself`);
    if (!conceptsById.has(prerequisiteId)) errors.push(`${path}.prerequisite_ids references unknown concept ${prerequisiteId}`);
  }
  for (const locale of ["en", "zh"]) {
    const display = concept.display?.[locale];
    requireString(display?.title, `${path}.display.${locale}.title`);
    requireString(display?.summary, `${path}.display.${locale}.summary`);
  }
  requireReferenceIds(concept.source_reference_ids, referencesById, `${path}.source_reference_ids`);
  requirePublicationGate(concept, path);
  for (const referenceId of concept.source_reference_ids ?? []) usedReferenceIds.add(referenceId);
}

for (const [index, exercise] of exercises.entries()) {
  const path = `${catalogPath}.exercises[${index}]`;
  requireString(exercise.lesson_slug, `${path}.lesson_slug`);
  requireString(exercise.dom_id, `${path}.dom_id`);
  requireReferenceIds([exercise.concept_id], conceptsById, `${path}.concept_id`);
  if (Object.hasOwn(exercise, "exercise_type") || Object.hasOwn(exercise, "answer_contract")) {
    errors.push(`${path} must not duplicate the canonical exercise contract`);
  }
  requireId(exercise.answer_code, `${path}.answer_code`);
  requireString(exercise.view_answer_value, `${path}.view_answer_value`);
  requireReferenceIds(exercise.source_reference_ids, referencesById, `${path}.source_reference_ids`);
  requirePublicationGate(exercise, path, `${path}.technical_review`);
  verifyExerciseInView(exercise, manifestById, path);
  usedConceptIds.add(exercise.concept_id);
  for (const referenceId of exercise.source_reference_ids ?? []) usedReferenceIds.add(referenceId);

  const lessonExercises = exercisesByLesson.get(exercise.lesson_slug) ?? [];
  lessonExercises.push(exercise.id);
  exercisesByLesson.set(exercise.lesson_slug, lessonExercises);
}

for (const [index, reference] of sourceReferences.entries()) {
  const path = `${catalogPath}.source_references[${index}]`;
  const keys = Object.keys(reference);
  if (keys.some((key) => key !== "id")) {
    errors.push(`${path} must keep provenance fields in the canonical source-reference registry`);
  }
}

for (const lesson of lessons) {
  const lessonExerciseIds = new Set(lesson.exercise_ids ?? []);
  for (const exerciseId of lessonExerciseIds) {
    const exercise = exercisesById.get(exerciseId);
    if (exercise && exercise.lesson_slug !== lesson.slug) errors.push(`lesson ${lesson.slug} references exercise ${exerciseId} from ${exercise.lesson_slug}`);
  }
  const actualExerciseIds = new Set(exercisesByLesson.get(lesson.slug) ?? []);
  if (actualExerciseIds.size !== lessonExerciseIds.size || [...actualExerciseIds].some((id) => !lessonExerciseIds.has(id))) {
    errors.push(`lesson ${lesson.slug}.exercise_ids must enumerate exactly its exercises`);
  }
}

for (const concept of concepts) {
  if (!usedConceptIds.has(concept.id)) errors.push(`concept ${concept.id} is not connected to a lesson or exercise`);
}
for (const reference of sourceReferences) {
  if (!usedReferenceIds.has(reference.id)) errors.push(`source reference ${reference.id} is not connected to a lesson, concept, or exercise`);
}

if (errors.length > 0) {
  console.error(`Content catalog validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const publishedCount = [...lessons, ...concepts, ...exercises, ...sourceReferences]
  .filter((record) => record.publication_status === "published").length;
console.log(`Content catalog validation passed: ${lessons.length} lessons, ${concepts.length} concepts, ${exercises.length} exercises, ${sourceReferences.length} source references, ${publishedCount} published.`);
