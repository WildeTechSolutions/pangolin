import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { accessPolicies } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const deletePolicyParamsSchema = z.object({
    orgId: z.string(),
    policyId: z.string().transform(Number).pipe(z.number().int().positive())
});

export async function deletePolicy(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = deletePolicyParamsSchema.safeParse(req.params);
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

        // Delete policy (cascades to groups and conditions)
        await db
            .delete(accessPolicies)
            .where(eq(accessPolicies.policyId, policyId));

        logger.info(`Policy deleted: ${policyId} from org ${orgId}`);

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Policy deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error deleting policy:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to delete policy"
            )
        );
    }
}
