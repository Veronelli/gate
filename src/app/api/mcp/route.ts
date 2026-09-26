import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser, unauthorized } from "@/lib/server/session";
import {
  loadDoc,
  saveDoc,
  MCP_SOURCES,
  tCreateList,
  tCreatePlace,
  tCreateProduct,
  tDeleteList,
  tGetList,
  tGetPlace,
  tInvitePlaceMember,
  tInviteToList,
  tListLists,
  tListPlaces,
  tListProducts,
  tRemoveListInvite,
  tRemovePlaceMember,
  tSetListInvitePermission,
  tSetListState,
  tSetPlaceMemberRole,
  tUpdateList,
  type DomainDoc,
} from "@/lib/server/mcpDomain";
import {
  notifyListChanges,
  type NotifyEnv,
  type DomainDoc as NotifyDoc,
} from "@/lib/server/listNotifications";

/**
 * Servidor MCP de food2check (streamable HTTP, JSON-RPC).
 * Corre dentro del deploy de Webflow Cloud. Identidad: Bearer token de
 * sesión → userId server-side. Cada tools/call exige `source` ("site" |
 * "telegram") y valida los permisos del dominio sobre el llamante real.
 */

const SOURCE_SCHEMA = {
  type: "string",
  enum: ["site", "telegram"],
  description: "Canal de origen de la operación (obligatorio).",
} as const;

const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: "object",
  properties: { source: SOURCE_SCHEMA, ...properties },
  required: ["source", ...required],
  additionalProperties: false,
});

const idProp = (desc: string) => ({ type: "string", description: desc });

const TOOLS: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Si muta listas/items, dispara el reporte consolidado de Telegram. */
  notify?: boolean;
  run: (d: DomainDoc, uid: string, a: Record<string, unknown>) => unknown;
}[] = [
  {
    name: "list_places",
    description: "Lista los lugares donde el usuario es miembro, con su rol.",
    inputSchema: obj({}),
    run: (d, u) => tListPlaces(d, u),
  },
  {
    name: "get_place",
    description:
      "Detalle de un lugar: miembros con rol y propietario. Requiere membresía.",
    inputSchema: obj({ placeId: idProp("ID del lugar") }, ["placeId"]),
    run: (d, u, a) => tGetPlace(d, u, String(a.placeId)),
  },
  {
    name: "create_place",
    description: "Crea un lugar nuevo; el usuario queda como propietario/admin.",
    inputSchema: obj({ name: { type: "string" } }, ["name"]),
    run: (d, u, a) => tCreatePlace(d, u, String(a.name)),
  },
  {
    name: "invite_place_member",
    description:
      "Invita un usuario al lugar con rol read|write. Solo admin del lugar.",
    inputSchema: obj(
      {
        placeId: idProp("ID del lugar"),
        username: { type: "string", description: "Username del invitado" },
        userId: { type: "string", description: "ID del invitado (alternativa)" },
        role: { type: "string", enum: ["read", "write"] },
      },
      ["placeId", "role"],
    ),
    run: (d, u, a) =>
      tInvitePlaceMember(
        d,
        u,
        String(a.placeId),
        {
          userId: a.userId ? String(a.userId) : undefined,
          username: a.username ? String(a.username) : undefined,
        },
        a.role as "read" | "write",
      ),
  },
  {
    name: "set_place_member_role",
    description:
      "Cambia el rol de un miembro (read|write|admin). Solo admin; no aplica al propietario.",
    inputSchema: obj(
      {
        placeId: idProp("ID del lugar"),
        userId: idProp("ID del miembro objetivo"),
        role: { type: "string", enum: ["read", "write", "admin"] },
      },
      ["placeId", "userId", "role"],
    ),
    run: (d, u, a) =>
      tSetPlaceMemberRole(
        d,
        u,
        String(a.placeId),
        String(a.userId),
        a.role as "read" | "write" | "admin",
      ),
  },
  {
    name: "remove_place_member",
    description: "Quita un miembro del lugar (no al propietario). Solo admin.",
    inputSchema: obj(
      {
        placeId: idProp("ID del lugar"),
        userId: idProp("ID del miembro a quitar"),
      },
      ["placeId", "userId"],
    ),
    run: (d, u, a) =>
      tRemovePlaceMember(d, u, String(a.placeId), String(a.userId)),
  },
  {
    name: "list_lists",
    description:
      "Listas visibles en un lugar (miembro o invitado de la lista).",
    inputSchema: obj({ placeId: idProp("ID del lugar") }, ["placeId"]),
    run: (d, u, a) => tListLists(d, u, String(a.placeId)),
  },
  {
    name: "get_list",
    description:
      "Detalle completo de una lista: meta, items, propietario e invitados.",
    inputSchema: obj({ listId: idProp("ID de la lista") }, ["listId"]),
    run: (d, u, a) => tGetList(d, u, String(a.listId)),
  },
  {
    name: "create_list",
    description:
      "Crea una lista en un lugar. Requiere permiso de escritura en el lugar.",
    inputSchema: obj(
      {
        placeId: idProp("ID del lugar"),
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        scheduledAt: {
          type: ["string", "null"],
          description: "ISO datetime o null",
        },
        importance: { type: "string", enum: ["alta", "media", "baja"] },
      },
      ["placeId", "name"],
    ),
    notify: true,
    run: (d, u, a) =>
      tCreateList(d, u, String(a.placeId), String(a.name), {
        description: a.description ? String(a.description) : undefined,
        tags: Array.isArray(a.tags) ? a.tags.map(String) : undefined,
        scheduledAt:
          a.scheduledAt === null
            ? null
            : a.scheduledAt
              ? String(a.scheduledAt)
              : undefined,
        importance: a.importance as "alta" | "media" | "baja" | undefined,
      }),
  },
  {
    name: "update_list",
    description:
      "Reemplazo completo del contenido provisto (PUT): meta e items. Requiere edición.",
    inputSchema: obj(
      {
        listId: idProp("ID de la lista"),
        name: { type: "string" },
        description: { type: "string" },
        state: {
          type: "string",
          enum: ["listando", "a_comprar", "comprando", "listo"],
        },
        tags: { type: "array", items: { type: "string" } },
        scheduledAt: { type: ["string", "null"] },
        importance: { type: "string", enum: ["alta", "media", "baja"] },
        items: {
          type: "array",
          description: "Reemplaza todos los items de la lista.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              productId: { type: "string" },
              name: { type: "string" },
              brand: { type: "string" },
              imageUrl: { type: "string" },
              suggestedPrice: { type: "number" },
              units: { type: "number" },
              checked: { type: "boolean" },
            },
            required: ["productId", "units"],
          },
        },
      },
      ["listId"],
    ),
    notify: true,
    run: (d, u, a) =>
      tUpdateList(d, u, String(a.listId), {
        name: a.name ? String(a.name) : undefined,
        description:
          a.description !== undefined ? String(a.description) : undefined,
        state: a.state as never,
        tags: Array.isArray(a.tags) ? a.tags.map(String) : undefined,
        scheduledAt:
          a.scheduledAt === null
            ? null
            : a.scheduledAt
              ? String(a.scheduledAt)
              : undefined,
        importance: a.importance as never,
        items: Array.isArray(a.items)
          ? (a.items as Parameters<typeof tUpdateList>[3]["items"])
          : undefined,
      }),
  },
  {
    name: "set_list_state",
    description:
      "Cambia el estado de la lista (listando|a_comprar|comprando|listo). Requiere edición.",
    inputSchema: obj(
      {
        listId: idProp("ID de la lista"),
        state: {
          type: "string",
          enum: ["listando", "a_comprar", "comprando", "listo"],
        },
      },
      ["listId", "state"],
    ),
    notify: true,
    run: (d, u, a) =>
      tSetListState(d, u, String(a.listId), a.state as never),
  },
  {
    name: "delete_list",
    description:
      "Elimina la lista con sus items e invitaciones. Requiere edición.",
    inputSchema: obj({ listId: idProp("ID de la lista") }, ["listId"]),
    notify: true,
    run: (d, u, a) => tDeleteList(d, u, String(a.listId)),
  },
  {
    name: "invite_to_list",
    description:
      "Invita un miembro del lugar a la lista (permiso read inicial). Solo admin de la lista.",
    inputSchema: obj(
      {
        listId: idProp("ID de la lista"),
        username: { type: "string" },
        userId: { type: "string" },
      },
      ["listId"],
    ),
    run: (d, u, a) =>
      tInviteToList(d, u, String(a.listId), {
        userId: a.userId ? String(a.userId) : undefined,
        username: a.username ? String(a.username) : undefined,
      }),
  },
  {
    name: "set_list_invite_permission",
    description:
      "Cambia el permiso de un invitado (read|edit). Solo admin de la lista.",
    inputSchema: obj(
      {
        listId: idProp("ID de la lista"),
        userId: idProp("ID del invitado"),
        permission: { type: "string", enum: ["read", "edit"] },
      },
      ["listId", "userId", "permission"],
    ),
    run: (d, u, a) =>
      tSetListInvitePermission(
        d,
        u,
        String(a.listId),
        String(a.userId),
        a.permission as "read" | "edit",
      ),
  },
  {
    name: "remove_list_invite",
    description: "Quita un invitado de la lista. Solo admin de la lista.",
    inputSchema: obj(
      {
        listId: idProp("ID de la lista"),
        userId: idProp("ID del invitado"),
      },
      ["listId", "userId"],
    ),
    run: (d, u, a) =>
      tRemoveListInvite(d, u, String(a.listId), String(a.userId)),
  },
  {
    name: "list_products",
    description: "Catálogo de productos del lugar. Requiere membresía.",
    inputSchema: obj({ placeId: idProp("ID del lugar") }, ["placeId"]),
    run: (d, u, a) => tListProducts(d, u, String(a.placeId)),
  },
  {
    name: "create_product",
    description:
      "Crea un producto en el catálogo del lugar. Requiere escritura.",
    inputSchema: obj(
      {
        placeId: idProp("ID del lugar"),
        name: { type: "string" },
        brand: { type: "string" },
        imageUrl: { type: "string" },
        suggestedPrice: { type: "number" },
        unitsRemaining: { type: "number" },
      },
      ["placeId", "name"],
    ),
    run: (d, u, a) =>
      tCreateProduct(d, u, String(a.placeId), {
        name: String(a.name),
        brand: a.brand ? String(a.brand) : undefined,
        imageUrl: a.imageUrl ? String(a.imageUrl) : undefined,
        suggestedPrice:
          a.suggestedPrice !== undefined ? Number(a.suggestedPrice) : undefined,
        unitsRemaining:
          a.unitsRemaining !== undefined ? Number(a.unitsRemaining) : undefined,
      }),
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

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
    { type: "text", text: JSON.stringify(payload, null, 2) },
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
          tools: TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        }),
      );
    case "tools/call": {
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      const tool = name ? TOOL_MAP.get(name) : undefined;
      if (!tool) {
        return NextResponse.json(
          rpcResult(id, toolText(`Tool desconocido: ${name ?? "(sin nombre)"}`, true)),
        );
      }
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
        const doc = await loadDoc();
        const prev = JSON.parse(JSON.stringify(doc)) as DomainDoc;
        const raw = tool.run(doc, user.id, args) as
          | { ok: boolean; value?: unknown; error?: string }
          | unknown;
        const result =
          raw && typeof raw === "object" && "ok" in raw
            ? (raw as { ok: boolean; value?: unknown; error?: string })
            : { ok: true, value: raw };
        if (!result.ok) {
          return NextResponse.json(
            rpcResult(id, toolText(result.error, true)),
          );
        }
        // Toda mutación persiste el doc; si toca listas/items se dispara
        // el mismo reporte consolidado de Telegram que PUT /api/state.
        await saveDoc(doc);
        if (tool.notify) {
          try {
            const { env, ctx } = await getCloudflareContext({
              async: true,
            });
            const notify = notifyListChanges(
              env as unknown as NotifyEnv,
              prev as NotifyDoc,
              doc as NotifyDoc,
            );
            if (ctx?.waitUntil) ctx.waitUntil(notify);
            else await notify;
          } catch (e) {
            console.warn("mcp notify:", e);
          }
        }
        return NextResponse.json(
          rpcResult(
            id,
            toolText({ ok: true, source, result: result.value }),
          ),
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
