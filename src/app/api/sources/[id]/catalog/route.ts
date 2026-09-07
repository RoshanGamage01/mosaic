import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { fieldFormats, fieldRoles } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  collection: z.string(),
  label: z.string().trim().min(1).max(80).optional(),
  noun: z.string().trim().min(1).max(80).optional(),
  hidden: z.boolean().optional(),
  primaryDateField: z.string().nullable().optional(),
  primaryMeasureField: z.string().nullable().optional(),
  fields: z
    .array(
      z.object({
        path: z.string(),
        label: z.string().trim().min(1).max(120).optional(),
        role: z.enum(fieldRoles).optional(),
        format: z.enum(fieldFormats).optional(),
        hidden: z.boolean().optional(),
        description: z.string().max(280).optional(),
      }),
    )
    .optional(),
});

/**
 * Lets a person correct the agent. Everything the scan guessed — labels, roles,
 * formats, what to hide — is editable and survives the next re-scan.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const catalog = await store.getCatalog(id);
    if (!catalog) return fail("Scan this connection before editing its catalog.", 404);

    const collection = catalog.collections.find((c) => c.name === body.collection);
    if (!collection) return fail("That data set is not in the catalog.", 404);

    if (body.label !== undefined) collection.label = body.label;
    if (body.noun !== undefined) collection.noun = body.noun;
    if (body.hidden !== undefined) collection.hidden = body.hidden;
    if (body.primaryDateField !== undefined)
      collection.primaryDateField = body.primaryDateField ?? undefined;
    if (body.primaryMeasureField !== undefined)
      collection.primaryMeasureField = body.primaryMeasureField ?? undefined;

    for (const patch of body.fields ?? []) {
      const field = collection.fields.find((f) => f.path === patch.path);
      if (!field) continue;
      if (patch.label !== undefined) field.label = patch.label;
      if (patch.role !== undefined) field.role = patch.role;
      if (patch.format !== undefined) field.format = patch.format;
      if (patch.hidden !== undefined) field.hidden = patch.hidden;
      if (patch.description !== undefined) field.description = patch.description;
    }

    await store.saveCatalog(catalog);
    return ok(collection);
  } catch (error) {
    return handleError(error);
  }
}
