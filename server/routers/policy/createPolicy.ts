import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import {
    accessPolicies,
    policyConditionGroups,
    policyConditions
} from "@server/db";
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

const createPolicySchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    action: z.enum(["ACCEPT", "DROP", "PASS"]),
    scope: z.enum(["ORGANIZATION", "RESOURCE"]).default("RESOURCE"),
    priority: z.number().int().default(0),
    conditionGroups: z.array(conditionGroupSchema).min(1)
});

const createPolicyParamsSchema = z.object({
    orgId: z.string()
});

export async function createPolicy(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = createPolicyParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const parsedBody = createPolicySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { orgId } = parsedParams.data;
    const {
        name,
        description,
        enabled,
        action,
        scope,
        priority,
        conditionGroups
    } = parsedBody.data;

    try {
        const now = new Date().toISOString();

        // Create the policy
        const [policy] = await db
            .insert(accessPolicies)
            .values({
                orgId,
                name,
                description,
                enabled,
                action,
                scope,
                priority,
                createdAt: now,
                updatedAt: now
            })
            .returning();

        // Create condition groups and their conditions
        for (const group of conditionGroups) {
            const [conditionGroup] = await db
                .insert(policyConditionGroups)
                .values({
                    policyId: policy.policyId,
                    operator: group.operator,
                    priority: group.priority
                })
                .returning();

            // Create conditions for this group
            const conditionsToInsert = group.conditions.map((condition) => ({
                groupId: conditionGroup.groupId,
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
                priority: condition.priority
            }));

            await db.insert(policyConditions).values(conditionsToInsert);
        }

        logger.info(`Policy created: ${policy.policyId} in org ${orgId}`);

        return response(res, {
            data: {
                message: "Policy created successfully",
                policy: { policyId: policy.policyId, name: policy.name }
            },
            success: true,
            error: false,
            message: "Policy created successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error creating policy:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create policy"
            )
        );
    }
}
