import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import {
    accessPolicies,
    policyConditionGroups,
    policyConditions,
    resourcePolicies
} from "@server/db";
import { eq, asc, sql } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const listPoliciesParamsSchema = z.object({
    orgId: z.string()
});

export async function listPolicies(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = listPoliciesParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const { orgId } = parsedParams.data;

    try {
        const policies = await db
            .select({
                policyId: accessPolicies.policyId,
                orgId: accessPolicies.orgId,
                name: accessPolicies.name,
                description: accessPolicies.description,
                enabled: accessPolicies.enabled,
                action: accessPolicies.action,
                priority: accessPolicies.priority,
                scope: accessPolicies.scope,
                createdAt: accessPolicies.createdAt,
                updatedAt: accessPolicies.updatedAt,
                resourceCount: sql<number>`COUNT(DISTINCT ${resourcePolicies.resourceId})`
            })
            .from(accessPolicies)
            .leftJoin(
                resourcePolicies,
                eq(accessPolicies.policyId, resourcePolicies.policyId)
            )
            .where(eq(accessPolicies.orgId, orgId))
            .groupBy(accessPolicies.policyId)
            .orderBy(asc(accessPolicies.priority));

        return response(res, {
            data: { policies },
            success: true,
            error: false,
            message: "Policies retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error listing policies:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to list policies"
            )
        );
    }
}
