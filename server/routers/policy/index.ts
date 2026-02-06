import { Router } from "express";
import { verifyOrgAccess } from "@server/middlewares";
import { listPolicies } from "./listPolicies";
import { createPolicy } from "./createPolicy";
import { updatePolicy } from "./updatePolicy";
import { deletePolicy } from "./deletePolicy";
import { getPolicy } from "./getPolicy";
import { getPolicyResources } from "./getPolicyResources";
import { setPolicyResources } from "./setPolicyResources";

const router = Router();

router.get("/:orgId/policies", verifyOrgAccess, listPolicies);
router.get("/:orgId/policies/:policyId", verifyOrgAccess, getPolicy);
router.put("/:orgId/policies", verifyOrgAccess, createPolicy);
router.post("/:orgId/policies/:policyId", verifyOrgAccess, updatePolicy);
router.delete("/:orgId/policies/:policyId", verifyOrgAccess, deletePolicy);
router.get(
    "/:orgId/policies/:policyId/resources",
    verifyOrgAccess,
    getPolicyResources
);
router.post(
    "/:orgId/policies/:policyId/resources",
    verifyOrgAccess,
    setPolicyResources
);

export default router;
