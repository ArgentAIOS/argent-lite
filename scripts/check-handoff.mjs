#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = process.argv[2];

if (!path) {
  console.error("Usage: node scripts/check-handoff.mjs <handoff.md>");
  process.exit(2);
}

const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const errors = [];

requirePattern(/^MERGE REQUEST — .+/m, "Missing `MERGE REQUEST — ...` header.");
requirePattern(/^Repo:\s+\S.+$/m, "Missing `Repo:` field.");
requirePattern(/^Linear:\s+\S.+$/m, "Missing `Linear:` field.");
requirePattern(/^Author:\s+\S.+$/m, "Missing `Author:` field.");

requireHeading("Source of truth:");
requireBullet("Source of truth:", "Branch");
requireBullet("Source of truth:", "Worktree");
requireBullet("Source of truth:", "Commit");
requireBullet("Source of truth:", "Tree state");

requireHeading("Intended files only:");
requireListItems("Intended files only:", "Expected at least one intended file.");

requireHeading("Explicit exclusions:");
requireListItems("Explicit exclusions:", "Expected at least one explicit exclusion.");

requireHeading("Validation:");
requireListItems("Validation:", "Expected at least one validation line.");

requireHeading("Operator validation still required:");
requireListItems(
  "Operator validation still required:",
  "Expected at least one operator or human validation item.",
);

requireHeading("Public docs:");
requireBullet("Public docs:", "Repo");
requireBullet("Public docs:", "Status");
requireBullet("Public docs:", "Files");
requireBullet("Public docs:", "Notes");

requireHeading("Conflicts / risks:");
requireListItems("Conflicts / risks:", "Expected at least one conflict or risk.");

requireHeading("Action required from Threadmaster:");
requireOrderedList(
  "Action required from Threadmaster:",
  "Expected at least one Threadmaster action.",
);

const repo = captureSingleLine(/^Repo:\s+(.+)$/m)?.trim() ?? "";
const sourceWithoutPublicDocs = removeSection("Public docs:");
const hasDocsRepoPath = /(?:\.mdx\b|docs\.json\b|docs-repo|mintlify-docs\/)/m.test(sourceWithoutPublicDocs);
const hasMultiRepoLanguage = /separate slice|separate handoff|separate packet/i.test(source);
const actionSection = extractSection("Action required from Threadmaster:");

if (repo && hasDocsRepoPath && !hasMultiRepoLanguage) {
  errors.push(
    "Main repo handoff appears to include docs-repo work. Use a separate slice and separate packet for the second repo.",
  );
}

if (/Tree state:\s*DIRTY/i.test(source) && !/Explicit exclusions:/m.test(source)) {
  errors.push("Dirty tree handoffs must include explicit exclusions.");
}

if (/branch name/i.test(source) && !/commit/i.test(source)) {
  errors.push("If branch truth is unreliable, the packet must explicitly anchor to commit truth.");
}

if (!/clean dev\/release lane|clean release lane/i.test(source)) {
  errors.push("Handoff must explicitly route reconstruction through the clean dev/release lane.");
}

if (!/operator|human/i.test(actionSection || source)) {
  errors.push("Threadmaster actions must include operator or human validation before main.");
}

if (errors.length > 0) {
  console.error("HANDOFF CHECK: FAIL");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("HANDOFF CHECK: PASS");

function requirePattern(pattern, message) {
  if (!pattern.test(source)) {
    errors.push(message);
  }
}

function requireHeading(heading) {
  if (!source.includes(heading)) {
    errors.push(`Missing heading: ${heading}`);
  }
}

function requireBullet(sectionHeading, bulletLabel) {
  const section = extractSection(sectionHeading);
  if (!section) {
    return;
  }
  const regex = new RegExp(`^-\\s+${escapeRegex(bulletLabel)}:\\s+.+$`, "m");
  if (!regex.test(section)) {
    errors.push(`Missing \`${bulletLabel}:\` entry under \`${sectionHeading}\``);
  }
}

function requireListItems(sectionHeading, message) {
  const section = extractSection(sectionHeading);
  if (!section) {
    return;
  }
  const items = section.match(/^- .+$/gm) ?? [];
  if (items.length === 0) {
    errors.push(message);
  }
}

function requireOrderedList(sectionHeading, message) {
  const section = extractSection(sectionHeading);
  if (!section) {
    return;
  }
  const items = section.match(/^\d+\. .+$/gm) ?? [];
  if (items.length === 0) {
    errors.push(message);
  }
}

function captureSingleLine(pattern) {
  return source.match(pattern)?.[1];
}

function extractSection(sectionHeading) {
  const escaped = escapeRegex(sectionHeading);
  const regex = new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n[A-Z][^\\n]+:\\n|\\n## |$)`, "m");
  const match = source.match(regex);
  if (!match) {
    return "";
  }
  return match[1].trim();
}

function removeSection(sectionHeading) {
  const escaped = escapeRegex(sectionHeading);
  const regex = new RegExp(`${escaped}\\n[\\s\\S]*?(?=\\n[A-Z][^\\n]+:\\n|\\n## |$)`, "m");
  return source.replace(regex, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
