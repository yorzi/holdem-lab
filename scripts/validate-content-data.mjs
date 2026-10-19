import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = "data/content/lesson-manifest-v1.json";
const errors = [];
const recordsById = new Map();
const recordsBySlugLocale = new Map();
const sourcePackets = new Map();

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
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
    errors.push(`${path} must contain at least ${minimum} item(s)`);
    return false;
  }
  return true;
}

function requireEnum(value, allowed, path) {
  if (!allowed.has(value)) {
    errors.push(`${path} must be one of: ${[...allowed].join(", ")}`);
  }
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

function requireDigest(value, path) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    errors.push(`${path} must be a lowercase SHA-256 digest`);
  }
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(root, relativePath))).digest("hex");
}

const manifest = readJson(manifestPath);
if (!manifest) process.exit(1);

if (manifest.schema_version !== 1) errors.push(`${manifestPath}.schema_version must be 1`);
requireString(manifest.manifest_id, `${manifestPath}.manifest_id`);

const hasRecords = requireArray(manifest.records, `${manifestPath}.records`, 1);
if (hasRecords) {
    const locales = new Set(["en", "zh"]);
    const contentModes = new Set(["original_authored_synthesis", "independent_authored_sibling"]);
    const publicationStatuses = new Set(["draft", "review_preview", "published", "retired"]);
    const rightsStatuses = new Set(["original_authored", "rights_review_required", "unknown", "restricted"]);

    for (const [index, record] of manifest.records.entries()) {
      const path = `${manifestPath}.records[${index}]`;
      if (!record || typeof record !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }

      requireString(record.id, `${path}.id`);
      if (recordsById.has(record.id)) errors.push(`${path}.id duplicates ${record.id}`);
      recordsById.set(record.id, record);

      if (record.kind !== "lesson") errors.push(`${path}.kind must be lesson`);
      requireString(record.slug, `${path}.slug`);
      requireEnum(record.locale, locales, `${path}.locale`);
      requireString(record.content_version, `${path}.content_version`);
      requireString(record.route_path, `${path}.route_path`);
      requireString(record.view_path, `${path}.view_path`);
      requireEnum(record.content_mode, contentModes, `${path}.content_mode`);
      requireEnum(record.publication_status, publicationStatuses, `${path}.publication_status`);
      requireEnum(record.rights_status, rightsStatuses, `${path}.rights_status`);
      requireDigest(record.asset_digest, `${path}.asset_digest`);
      requireReview(record.domain_review, `${path}.domain_review`);

      if (record.locale === "en" && record.content_mode !== "original_authored_synthesis") {
        errors.push(`${path}.content_mode must be original_authored_synthesis for en`);
      }
      if (record.locale === "zh" && record.content_mode !== "independent_authored_sibling") {
        errors.push(`${path}.content_mode must be independent_authored_sibling for zh`);
      }

      const expectedRoute = record.locale === "en" ? `/learn/${record.slug}` : `/zh/learn/${record.slug}`;
      if (record.route_path !== expectedRoute) errors.push(`${path}.route_path must be ${expectedRoute}`);

      if (!existsSync(resolve(root, record.view_path))) {
        errors.push(`${path}.view_path does not exist: ${record.view_path}`);
      } else if (/^[a-f0-9]{64}$/.test(record.asset_digest)) {
        const actualDigest = sha256(record.view_path);
        if (record.asset_digest !== actualDigest) errors.push(`${path}.asset_digest does not match ${record.view_path}`);
      }

      if (requireArray(record.source_packet_ids, `${path}.source_packet_ids`)) {
        const uniquePacketIds = new Set(record.source_packet_ids);
        if (uniquePacketIds.size !== record.source_packet_ids.length) errors.push(`${path}.source_packet_ids must be unique`);

        for (const packetId of record.source_packet_ids) {
          if (!/^[a-z0-9-]+$/.test(packetId)) {
            errors.push(`${path}.source_packet_ids contains an invalid id: ${packetId}`);
            continue;
          }

          const packetPath = `data/quality/source_packets/${packetId}.json`;
          const packet = sourcePackets.has(packetId) ? sourcePackets.get(packetId) : readJson(packetPath);
          sourcePackets.set(packetId, packet);
          if (!packet) continue;
          if (packet.lesson_slug !== record.slug) errors.push(`${path} source packet ${packetId} lesson_slug does not match ${record.slug}`);
          if (record.locale === "en" && packet.locale !== "en") errors.push(`${path} English content must reference an English source packet`);
          if (record.locale === "zh" && packet.locale !== "en") errors.push(`${path} Chinese sibling provenance must reference the English source packet layer`);
        }
      }

      if (record.technical_review?.status !== "passed") errors.push(`${path}.technical_review.status must be passed before manifest inclusion`);
      requireArray(record.technical_review?.evidence, `${path}.technical_review.evidence`);
      for (const evidence of record.technical_review?.evidence ?? []) {
        if (typeof evidence === "string" && evidence.startsWith("test/") && !existsSync(resolve(root, evidence))) {
          errors.push(`${path}.technical_review.evidence references missing test ${evidence}`);
        }
      }
      requireString(record.rights_notes, `${path}.rights_notes`);

      const slugLocaleKey = `${record.slug}:${record.locale}`;
      if (recordsBySlugLocale.has(slugLocaleKey)) errors.push(`${path} duplicates ${slugLocaleKey}`);
      recordsBySlugLocale.set(slugLocaleKey, record);

      if (record.publication_status === "published" && (
        record.domain_review?.status !== "approved" ||
        record.rights_status !== "original_authored" ||
        record.technical_review?.status !== "passed"
      )) {
        errors.push(`${path} cannot be published before technical, domain, and rights gates pass`);
      }
    }

    for (const record of manifest.records) {
      if (!recordsBySlugLocale.has(`${record.slug}:en`)) errors.push(`missing English content sibling for ${record.slug}`);
      if (record.locale === "zh" && !recordsBySlugLocale.has(`${record.slug}:en`)) errors.push(`Chinese record ${record.id} has no English sibling`);
    }
}

if (errors.length > 0) {
  console.error(`Content data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const publishedCount = manifest.records.filter((record) => record.publication_status === "published").length;
console.log(`Content data validation passed: ${manifest.records.length} lesson assets, ${publishedCount} published, ${sourcePackets.size} source packets; domain review remains explicit per record.`);
