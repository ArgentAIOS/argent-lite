#!/usr/bin/env node

import { readFileSync } from "node:fs";

const eventPath = process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  console.error("GITHUB_EVENT_PATH is required.");
  process.exit(2);
}

const payload = JSON.parse(readFileSync(eventPath, "utf8"));
const pullRequest = payload.pull_request;

if (!pullRequest) {
  console.log("No pull request payload present. Skipping.");
  process.exit(0);
}

const title = pullRequest.title || "";
const body = pullRequest.body || "";
const errors = [];

if (title.trim().length < 8) {
  errors.push("PR title is too short to be meaningful.");
}

for (const heading of [
  "## Summary",
  "## Linked Issue / PR",
  "## Root Cause / Regression History",
  "## Regression Test Plan",
  "## Validation",
  "## Human Verification",
  "## Risk and Recovery"
]) {
  if (!body.includes(heading)) {
    errors.push(`Missing required PR section: ${heading}`);
  }
}

if (!/Problem:/i.test(body) || !/What changed:/i.test(body)) {
  errors.push("PR summary must describe the problem and the change.");
}

if (!/Root cause:/i.test(body)) {
  errors.push("PR must include a root cause statement or `N/A`.");
}

if (!/Target test or file:/i.test(body)) {
  errors.push("PR must name the smallest regression guardrail or explain why none was added.");
}

if (!/Verified scenarios:/i.test(body)) {
  errors.push("PR must include human verification details.");
}

if (errors.length > 0) {
  console.error("PR INTAKE CHECK: FAIL");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("PR INTAKE CHECK: PASS");
