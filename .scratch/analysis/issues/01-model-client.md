# 01: The model client

Status: done 2026-09-15

**What to build:** One transport for every model-backed operation in the
product. OpenRouter's OpenAI-compatible endpoint, called from server code only,
returning structured JSON parsed against a declared schema.

The model id comes from `OPENROUTER_MODEL` and is never written into code — not
as a default, not as a fallback, not in a comment that a later session copies.
Its absence is an error whose message names the variable. The key comes from
`OPENROUTER_API_KEY` and never reaches the browser.

Every request pins the provider (`order: ["fireworks"]`,
`allow_fallbacks: false`, `require_parameters: true`), sets reasoning effort to
`low`, and asks for strict structured JSON against a schema the caller supplies.
A response that does not parse against that schema is an error, not a value to
be coerced into one.

This ticket also ships the fixture-backed stub the whole test suite runs on: a
`ModelClient` built from `tests/fixtures/*.expected.json`, so the suite runs
with no API key. The stub replaces the network and nothing else.

**Blocked by:** None.

- [x] A `ModelClient` interface with one structured-output operation, used by
      every later model call in the product
- [x] The transport posts to OpenRouter's OpenAI-compatible chat completions
      endpoint with the pinned provider block, `reasoning: { effort: "low" }`
      and a strict `json_schema` response format
- [x] The model id is read from `OPENROUTER_MODEL` at call time; no model id
      string exists anywhere in `src/`
- [x] A missing `OPENROUTER_MODEL` or `OPENROUTER_API_KEY` produces an error
      naming the variable, not a silent fallback
- [x] The client is server-only and is never imported from a client component
- [x] A malformed or schema-violating response is an error; nothing is coerced
- [x] A non-2xx response and a network failure each surface as a typed failure
      the caller can render as copy
- [x] A fixture-backed stub client exists for tests, built from the sidecars,
      and the suite runs with no environment variables set
- [x] Tests cover the request the transport builds and the parsing of a
      well-formed, a malformed and an error response, without hitting the network
