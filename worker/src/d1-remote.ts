// Talks to a *different* Cloudflare account's D1 database over the REST API,
// since a Worker binding can only ever reach a database in its own account.

interface D1RestResult {
  success: boolean;
  result: Array<{
    results: Record<string, unknown>[];
    success: boolean;
  }>;
  errors: Array<{ code: number; message: string }>;
}

export async function queryRemoteD1(
  accountId: string,
  databaseId: string,
  apiToken: string,
  sql: string,
  params?: unknown[]
): Promise<Record<string, unknown>[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params ? { sql, params } : { sql }),
  });

  const body = (await response.json()) as D1RestResult;

  if (!response.ok || !body.success) {
    const message = body.errors?.map((e) => e.message).join("; ") || response.statusText;
    throw new Error(`D1 REST API error: ${message}`);
  }

  return body.result[0]?.results ?? [];
}
