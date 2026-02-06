import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import {
    accessPolicies,
    policyConditionGroups,
    policyConditions
} from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const conditionSchema = z.object({
    field: z.enum([
        "IP",
        "COUNTRY",
        "ASN",
        "CIDR",
        "PATH",
        "HEADER",
        "METHOD",
        "USER_AGENT"
    ]),
    operator: z.enum([
        "EQUALS",
        "NOT_EQUALS",
        "CONTAINS",
        "NOT_CONTAINS",
        "IN",
        "NOT_IN",
        "MATCHES",
        "NOT_MATCHES"
    ]),
    value: z.string().min(1),
    priority: z.number().int().default(0)
});

const conditionGroupSchema = z.object({
    operator: z.enum(["AND", "OR"]),
    conditions: z.array(conditionSchema).min(1),
    priority: z.number().int().default(0)
});

const updatePolicySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    action: z.enum(["ACCEPT", "DROP", "PASS"]).optional(),
    scope: z.enum(["ORGANIZATION", "RESOURCE"]).optional(),
    priority: z.number().int().optional(),
    conditionGroups: z.array(conditionGroupSchema).optional()
});

const updatePolicyParamsSchema = z.object({
    orgId: z.string(),
    policyId: z.string().transform(Number).pipe(z.number().int().positive())
});

export async function updatePolicy(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = updatePolicyParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const parsedBody = updatePolicySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { orgId, policyId } = parsedParams.data;
    const updates = parsedBody.data;

    try {
        // Verify policy belongs to org
        const [policy] = await db
            .select()
            .from(accessPolicies)
            .where(eq(accessPolicies.policyId, policyId));

        if (!policy || policy.orgId !== orgId) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Policy not found")
            );
        }

        // Update policy metadata
        const policyUpdates: any = { updatedAt: new Date().toISOString() };
        if (updates.name !== undefined) policyUpdates.name = updates.name;
        if (updates.description !== undefined)
            policyUpdates.description = updates.description;
        if (updates.enabled !== undefined)
            policyUpdates.enabled = updates.enabled;
        if (updates.action !== undefined) policyUpdates.action = updates.action;
        if (updates.priority !== undefined)
            policyUpdates.priority = updates.priority;

        await db
            .update(accessPolicies)
            .set(policyUpdates)
            .where(eq(accessPolicies.policyId, policyId));

        // If condition groups are provided, replace them
        if (updates.conditionGroups) {
            // Delete existing condition groups (cascades to conditions)
            await db
                .delete(policyConditionGroups)
                .where(eq(policyConditionGroups.policyId, policyId));

            // Create new condition groups
            for (const group of updates.conditionGroups) {
                const [conditionGroup] = await db
                    .insert(policyConditionGroups)
                    .values({
                        policyId: policyId,
                        operator: group.operator,
                        priority: group.priority
                    })
                    .returning();

                // Create conditions for this group
                const conditionsToInsert = group.conditions.map(
                    (condition) => ({
                        groupId: conditionGroup.groupId,
                        field: condition.field,
                        operator: condition.operator,
                        value: condition.value,
                        priority: condition.priority
                    })
                );

                await db.insert(policyConditions).values(conditionsToInsert);
            }
        }

        logger.info(`Policy updated: ${policyId} in org ${orgId}`);

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Policy updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error updating policy:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to update policy"
            )
        );
    }
}
