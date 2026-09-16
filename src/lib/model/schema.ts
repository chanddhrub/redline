/**
 * One declaration, two uses: the JSON Schema sent to OpenRouter and the
 * validation run over what comes back are generated from the same Zod type, so
 * they cannot drift apart. A hand-written pair would drift on the first schema
 * change, and the drift would show up as a model that "returns the wrong
 * shape".
 */

import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

export interface ModelSchema<T> {
  /** The `json_schema.name` OpenRouter requires. */
  name: string;
  /** Strict-mode JSON Schema, derived from the same type used to validate. */
  jsonSchema: JsonSchema;
  parse(value: unknown): ParseOutcome<T>;
}

export type ParseOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; detail: string };

export function modelSchema<T>(name: string, type: z.ZodType<T>): ModelSchema<T> {
  const jsonSchema = toStrictJsonSchema(
    z.toJSONSchema(type, { target: "draft-2020-12", io: "output" }) as JsonSchema,
  );

  return {
    name,
    jsonSchema,
    parse(value: unknown): ParseOutcome<T> {
      const result = type.safeParse(value);
      if (result.success) return { ok: true, value: result.data };
      return { ok: false, detail: describeIssues(result.error) };
    },
  };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * OpenAI-compatible strict structured output is narrower than JSON Schema: no
 * `$schema`, every object closed, and every declared property listed in
 * `required`. Optionality is expressed by a nullable type instead, which is why
 * the payload schemas below use `.nullable()` rather than `.optional()`.
 *
 * This walk enforces the closure and the required list. It does not invent
 * nullability — a schema that relies on `.optional()` would be sent as
 * required, which is a declaration the caller should not have written.
 */
export function toStrictJsonSchema(schema: JsonSchema): JsonSchema {
  return strictify(schema) as JsonSchema;
}

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (node === null || typeof node !== "object") return node;

  const source = node as JsonSchema;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema") continue;
    out[key] = strictify(value);
  }

  const properties = out.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    out.additionalProperties = false;
    out.required = Object.keys(properties as JsonSchema);
  }

  return out;
}
