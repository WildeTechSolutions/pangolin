import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import {
    accessPolicies,
    policyConditionGroups,
    policyConditions
} from "@server/db";
import { eq, asc } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const getPolicyParamsSchema = z.object({
    orgId: z.string(),
    policyId: z.string().transform(Number).pipe(z.number().int().positive())
});

export async function getPolicy(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = getPolicyParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const { orgId, policyId } = parsedParams.data;

    try {
        // Get policy
        const [policy] = await db
            .select()
            .from(accessPolicies)
            .where(eq(accessPolicies.policyId, policyId));

        if (!policy || policy.orgId !== orgId) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Policy not found")
            );
        }

        // Get condition groups
        const groups = await db
            .select()
            .from(policyConditionGroups)
            .where(eq(policyConditionGroups.policyId, policyId))
            .orderBy(asc(policyConditionGroups.priority));

        // Get conditions for each group
        const conditionGroups = await Promise.all(
            groups.map(async (group) => {
                const conditions = await db
                    .select()
                    .from(policyConditions)
                    .where(eq(policyConditions.groupId, group.groupId))
                    .orderBy(asc(policyConditions.priority));

                return {
                    groupId: group.groupId,
                    operator: group.operator,
                    priority: group.priority,
                    conditions
                };
            })
        );

        return response(res, {
            data: {
                policy: {
                    ...policy,
                    conditionGroups
                }
            },
            success: true,
            error: false,
            message: "Policy retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error getting policy:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to get policy"
            )
        );
    }
}
