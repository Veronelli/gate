import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/server/session";
import { MCP_SOURCES } from "@/lib/server/mcpDomain";
import { MCP_TOOLS, callMcpTool } from "@/lib/server/mcpTools";

/**
 * Servidor MCP de food2check (streamable HTTP, JSON-RPC).
 * Corre dentro del deploy de Webflow Cloud. Identidad: Bearer token de
 * sesión → userId server-side. Cada tools/call exige `source` ("site" |
 * "telegram") y valida los permisos del dominio sobre el llamante real.
 */

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

const rpcError = (
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const rpcResult = (id: JsonRpcRequest["id"], result: unknown) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  result,
});

const toolText = (payload: unknown, isError = false) => ({
  content: [
    { type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
  ],
  isError,
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();

  const req = (await request.json().catch(() => null)) as JsonRpcRequest | null;
  if (!req || typeof req.method !== "string") {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
    });
  }
  const { id, method } = req;

  switch (method) {
    case "initialize":
      return NextResponse.json(
        rpcResult(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "food2check-mcp", version: "1.0.0" },
        }),
      );
    case "ping":
      return NextResponse.json(rpcResult(id, {}));
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });
    case "tools/list":
      return NextResponse.json(
        rpcResult(id, {
          tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        }),
      );
    case "tools/call": {
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      // `source` obligatorio: canal de origen de la operación.
      const source = args.source;
      if (typeof source !== "string" || !MCP_SOURCES.includes(source as never)) {
        return NextResponse.json(
          rpcResult(
            id,
            toolText(
              `Falta el parámetro obligatorio "source" (valores: ${MCP_SOURCES.join(", ")}).`,
              true,
            ),
          ),
        );
      }
      try {
        const res = await callMcpTool(user.id, source as never, name ?? "", args);
        return NextResponse.json(
          rpcResult(id, toolText(res.text, res.isError)),
        );
      } catch (e) {
        return NextResponse.json(
          rpcError(
            id,
            -32603,
            e instanceof Error ? e.message : "Error interno",
          ),
        );
      }
    }
    default:
      return NextResponse.json(
        rpcError(id, -32601, `Método no soportado: ${method}`),
      );
  }
}
