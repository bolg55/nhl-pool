// TODO(temporary scaffolding): Replace local TemplateHeaders/TemplateQuery types
// with '@seontechnologies/pactjs-utils' exports when available.

type TemplateHeaders = Record<string, string | number | boolean>;
type TemplateQueryValue = string | number | boolean | Array<string | number | boolean>;
type TemplateQuery = Record<string, TemplateQueryValue>;

export type ProviderStateInput = {
  name: string;
  params: Record<string, unknown>;
};

type JsonMap = { [key: string]: boolean | number | string | null | JsonMap | Array<unknown> };
type JsonContentBuilder = {
  headers: (headers: TemplateHeaders) => unknown;
  jsonBody: (body: unknown) => unknown;
  query?: (query: TemplateQuery) => unknown;
};

export type JsonContentInput = {
  body?: unknown;
  headers?: TemplateHeaders;
  query?: TemplateQuery;
};

export const toJsonMap = (obj: Record<string, unknown>): JsonMap =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (value === null || value === undefined) return [key, "null"];
      if (typeof value === "object" && !(value instanceof Date) && !Array.isArray(value))
        return [key, JSON.stringify(value)];
      if (typeof value === "number" || typeof value === "boolean") return [key, value];
      if (value instanceof Date) return [key, value.toISOString()];
      return [key, String(value)];
    }),
  );

export const createProviderState = ({ name, params }: ProviderStateInput): [string, JsonMap] => [
  name,
  toJsonMap(params),
];

export const setJsonContent =
  ({ body, headers, query }: JsonContentInput) =>
  (builder: JsonContentBuilder): void => {
    if (query && builder.query) {
      builder.query(query);
    }

    if (headers) {
      builder.headers(headers);
    }

    if (body !== undefined) {
      builder.jsonBody(body);
    }
  };

export const setJsonBody = (body: unknown) => setJsonContent({ body });
