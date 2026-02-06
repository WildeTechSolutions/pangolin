import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourcePolicies, resources } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const getPolicyResourcesParamsSchema = z.object({
    orgId: z.string(),
    policyId: z.string().transform(Number).pipe(z.number().int().positive())
});

export async function getPolicyResources(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = getPolicyResourcesParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const { policyId } = parsedParams.data;

    try {
        const policyResourcesList = await db
            .select({
                resourceId: resources.resourceId,
                niceId: resources.niceId,
                name: resources.name,
                priority: resourcePolicies.priority
            })
            .from(resourcePolicies)
            .innerJoin(
                resources,
                eq(resourcePolicies.resourceId, resources.resourceId)
            )
            .where(eq(resourcePolicies.policyId, policyId));

        return response(res, {
            data: { resources: policyResourcesList },
            success: true,
            error: false,
            message: "Policy resources retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
