import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourcePolicies, accessPolicies } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const setPolicyResourcesBodySchema = z.object({
    resourceIds: z.array(z.number().int().positive())
});

const setPolicyResourcesParamsSchema = z.object({
    orgId: z.string(),
    policyId: z.string().transform(Number).pipe(z.number().int().positive())
});

export async function setPolicyResources(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = setPolicyResourcesParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const parsedBody = setPolicyResourcesBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { orgId, policyId } = parsedParams.data;
    const { resourceIds } = parsedBody.data;

    try {
        // Verify policy exists and belongs to org
        const [policy] = await db
            .select()
            .from(accessPolicies)
            .where(eq(accessPolicies.policyId, policyId));

        if (!policy || policy.orgId !== orgId) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Policy not found")
            );
        }

        // Delete existing assignments
        await db
            .delete(resourcePolicies)
            .where(eq(resourcePolicies.policyId, policyId));

        // Insert new assignments
        if (resourceIds.length > 0) {
            await db.insert(resourcePolicies).values(
                resourceIds.map((resourceId, index) => ({
                    policyId,
                    resourceId,
                    priority: index
                }))
            );
        }

        return response(res, {
            data: { count: resourceIds.length },
            success: true,
            error: false,
            message: "Policy resources updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
