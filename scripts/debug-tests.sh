#!/usr/bin/env bash
# scripts/debug-tests.sh
#
# Adversarial / error-path tests against a running Economics Expert backend.
# These tests verify the API NEVER returns a non-JSON / non-NDJSON body and
# that error messages are always JSON-parseable so the client can render them.
#
# Usage:
#   ./scripts/debug-tests.sh                            # local dev server
#   BASE=https://economics-master.vercel.app ./scripts/debug-tests.sh
#
# Requirements: curl, jq, bash 4+.

set -u

BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0
SKIP=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }

assert() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    printf "  %s %s\n" "$(green PASS)" "$name"
    PASS=$((PASS + 1))
  else
    printf "  %s %s\n        expected (substring): %s\n        actual:               %s\n" \
      "$(red FAIL)" "$name" "$expected" "$(echo "$actual" | head -c 300)"
    FAIL=$((FAIL + 1))
  fi
}

assert_json() {
  local name="$1"
  local body="$2"
  if echo "$body" | jq -e . >/dev/null 2>&1; then
    printf "  %s %s\n" "$(green PASS)" "$name"
    PASS=$((PASS + 1))
  else
    printf "  %s %s\n        body was not valid JSON: %s\n" \
      "$(red FAIL)" "$name" "$(echo "$body" | head -c 300)"
    FAIL=$((FAIL + 1))
  fi
}

section() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "  BASE = $BASE"
  echo "============================================================"
}

# ---------- /api/chat ----------
section "POST /api/chat — error paths"

echo "[1] empty body"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '' "$BASE/api/chat")
assert_json "1.A response is JSON-parseable" "$RESP"
assert "1.B response has 'error' field" '"error"' "$RESP"

echo "[2] malformed JSON body"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{not-json' "$BASE/api/chat")
assert_json "2.A response is JSON-parseable" "$RESP"
assert "2.B response says 'Invalid JSON'" "Invalid JSON" "$RESP"

echo "[3] missing messages array"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{}' "$BASE/api/chat")
assert_json "3.A response is JSON-parseable" "$RESP"
assert "3.B mentions non-empty user message" "non-empty user message" "$RESP"

echo "[4] empty messages array"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{"messages":[]}' "$BASE/api/chat")
assert_json "4.A response is JSON-parseable" "$RESP"
assert "4.B mentions non-empty user message" "non-empty user message" "$RESP"

echo "[5] last message is assistant (not user)"
RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"assistant","content":"hi"}]}' "$BASE/api/chat")
assert_json "5.A response is JSON-parseable" "$RESP"
assert "5.B rejects non-user last message" "non-empty user message" "$RESP"

echo "[6] empty user message string"
RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"   "}]}' "$BASE/api/chat")
assert_json "6.A response is JSON-parseable" "$RESP"

echo "[7] valid request — should return NDJSON stream (Content-Type)"
HEADERS=$(curl -s -D - -o /dev/null --max-time 90 -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the law of demand?"}]}' \
  "$BASE/api/chat")
assert "7.A Content-Type is application/x-ndjson" "application/x-ndjson" "$HEADERS"

echo "[8] valid request — first NDJSON line is a meta event"
FIRST=$(curl -s --max-time 90 -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is opportunity cost?"}]}' \
  "$BASE/api/chat" | head -n 1)
assert_json "8.A first line is JSON" "$FIRST"
assert "8.B first event has type meta" '"type":"meta"' "$FIRST"
assert "8.C first event includes citations" '"citations"' "$FIRST"

# ---------- /api/quiz ----------
section "POST /api/quiz — error paths"

echo "[9] empty body"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '' "$BASE/api/quiz")
assert_json "9.A response is JSON-parseable" "$RESP"
assert "9.B response is rejected with an 'error' field" '"error"' "$RESP"

echo "[10] malformed JSON"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{not-json' "$BASE/api/quiz")
assert_json "10.A response is JSON-parseable" "$RESP"
assert "10.B response says 'Invalid JSON'" "Invalid JSON" "$RESP"

echo "[11] missing topic"
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{}' "$BASE/api/quiz")
assert_json "11.A response is JSON-parseable" "$RESP"
assert "11.B response says topic is required" "topic is required" "$RESP"

echo "[12] empty topic string"
RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"topic":"","count":5}' "$BASE/api/quiz")
assert_json "12.A response is JSON-parseable" "$RESP"
assert "12.B response says topic is required" "topic is required" "$RESP"

echo "[13] count clamped to 10 — sanity (don't actually run, just check it doesn't 4xx)"
# Skip — runs the model

# ---------- summary ----------
echo ""
echo "============================================================"
echo "  Results: $(green "$PASS passed"), $(red "$FAIL failed"), $(yellow "$SKIP skipped")"
echo "============================================================"

[[ "$FAIL" -eq 0 ]]
