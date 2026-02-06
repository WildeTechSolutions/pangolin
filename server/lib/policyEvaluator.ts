import { db } from "@server/db";
import {
    accessPolicies,
    policyConditionGroups,
    policyConditions,
    resourcePolicies,
    PolicyCondition,
    PolicyConditionGroup
} from "@server/db";
import { eq, and } from "drizzle-orm";
import { isIpInCidr } from "@server/lib/ip";
import { getCountryCodeForIp } from "@server/lib/geoip";
import { getAsnForIp } from "@server/lib/asn";
import logger from "@server/logger";
import cache from "@server/lib/cache";

export interface PolicyEvaluationContext {
    clientIp?: string;
    path?: string;
    headers?: Record<string, string>;
    method?: string;
    countryCode?: string;
    asn?: number;
}

interface PolicyWithConditions {
    policyId: number;
    name: string;
    action: string;
    priority: number;
    enabled: boolean;
    conditionGroups: Array<{
        groupId: number;
        operator: string;
        priority: number;
        conditions: PolicyCondition[];
    }>;
}

/**
 * Evaluate all policies for a given resource
 */
export async function evaluatePolicies(
    resourceId: number,
    context: PolicyEvaluationContext,
    orgId?: number
): Promise<"ACCEPT" | "DROP" | "PASS" | undefined> {
    // First check organization-wide policies if orgId is provided
    if (orgId !== undefined) {
        const orgCacheKey = `org_policies:${orgId}`;
        
        let orgPolicyIds: number[] | undefined = cache.get(orgCacheKey);
        
        if (!orgPolicyIds) {
            const orgPolicies = await db
                .select()
                .from(accessPolicies)
                .where(and(
                    eq(accessPolicies.orgId, orgId.toString()),
                    eq(accessPolicies.scope, "ORGANIZATION")
                ))
                .orderBy(accessPolicies.priority);
            
            orgPolicyIds = orgPolicies.map(p => p.policyId);
            cache.set(orgCacheKey, orgPolicyIds, 300); // 5 minutes
        }
        
        // Evaluate organization-wide policies
        for (const policyId of orgPolicyIds) {
            const policy = await loadPolicy(policyId);
            
            if (!policy || !policy.enabled) {
                continue;
            }
            
            const matches = await evaluatePolicy(policy, context);
            
            if (matches) {
                logger.debug(`Organization-wide policy ${policy.name} (${policyId}) matched, action: ${policy.action}`);
                return policy.action as any;
            }
        }
    }
    
    // Then check resource-specific policies
    const cacheKey = `resource_policies:${resourceId}`;
    
    // Get policies linked to this resource
    let policyIds: number[] | undefined = cache.get(cacheKey);
    
    if (!policyIds) {
        const resourcePolicyLinks = await db
            .select()
            .from(resourcePolicies)
            .where(eq(resourcePolicies.resourceId, resourceId))
            .orderBy(resourcePolicies.priority);
        
        policyIds = resourcePolicyLinks.map(rp => rp.policyId);
        cache.set(cacheKey, policyIds, 300); // 5 minutes
    }
    
    if (policyIds.length === 0) {
        return undefined; // No policies configured
    }
    
    // Load and evaluate policies in priority order
    for (const policyId of policyIds) {
        const policy = await loadPolicy(policyId);
        
        if (!policy || !policy.enabled) {
            continue;
        }
        
        const matches = await evaluatePolicy(policy, context);
        
        if (matches) {
            logger.debug(`Resource-specific policy ${policy.name} (${policyId}) matched, action: ${policy.action}`);
            return policy.action as any;
        }
    }
    
    return undefined; // No policy matched
}

/**
 * Load a policy with all its condition groups and conditions
 */
async function loadPolicy(policyId: number): Promise<PolicyWithConditions | null> {
    const cacheKey = `policy:${policyId}`;
    
    let policy: PolicyWithConditions | undefined = cache.get(cacheKey);
    
    if (!policy) {
        // Get policy
        const [policyData] = await db
            .select()
            .from(accessPolicies)
            .where(eq(accessPolicies.policyId, policyId));
        
        if (!policyData) {
            return null;
        }
        
        // Get condition groups
        const groups = await db
            .select()
            .from(policyConditionGroups)
            .where(eq(policyConditionGroups.policyId, policyId))
            .orderBy(policyConditionGroups.priority);
        
        // Get conditions for each group
        const conditionGroups = await Promise.all(
            groups.map(async (group) => {
                const conditions = await db
                    .select()
                    .from(policyConditions)
                    .where(eq(policyConditions.groupId, group.groupId))
                    .orderBy(policyConditions.priority);
                
                return {
                    groupId: group.groupId,
                    operator: group.operator,
                    priority: group.priority,
                    conditions
                };
            })
        );
        
        policy = {
            policyId: policyData.policyId,
            name: policyData.name,
            action: policyData.action,
            priority: policyData.priority,
            enabled: policyData.enabled,
            conditionGroups
        };
        
        cache.set(cacheKey, policy, 300); // 5 minutes
    }
    
    return policy;
}

/**
 * Evaluate a single policy against the context
 */
async function evaluatePolicy(
    policy: PolicyWithConditions,
    context: PolicyEvaluationContext
): Promise<boolean> {
    // All condition groups must evaluate to true (AND between groups)
    for (const group of policy.conditionGroups) {
        const groupMatches = await evaluateConditionGroup(group, context);
        if (!groupMatches) {
            return false; // One group failed, policy doesn't match
        }
    }
    
    return true; // All groups matched
}

/**
 * Evaluate a condition group (AND/OR logic within the group)
 */
async function evaluateConditionGroup(
    group: {
        operator: string;
        conditions: PolicyCondition[];
    },
    context: PolicyEvaluationContext
): Promise<boolean> {
    if (group.operator === "AND") {
        // All conditions must be true
        for (const condition of group.conditions) {
            const matches = await evaluateCondition(condition, context);
            if (!matches) {
                return false;
            }
        }
        return true;
    } else if (group.operator === "OR") {
        // At least one condition must be true
        for (const condition of group.conditions) {
            const matches = await evaluateCondition(condition, context);
            if (matches) {
                return true;
            }
        }
        return false;
    }
    
    return false;
}

/**
 * Evaluate a single condition
 */
async function evaluateCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
): Promise<boolean> {
    const { field, operator, value } = condition;
    
    switch (field) {
        case "IP":
            return evaluateIpCondition(context.clientIp, operator, value);
        
        case "CIDR":
            return evaluateCidrCondition(context.clientIp, operator, value);
        
        case "COUNTRY":
            return await evaluateCountryCondition(context, operator, value);
        
        case "ASN":
            return await evaluateAsnCondition(context, operator, value);
        
        case "PATH":
            return evaluatePathCondition(context.path, operator, value);
        
        case "METHOD":
            return evaluateStringCondition(context.method, operator, value);
        
        case "HEADER":
            return evaluateHeaderCondition(context.headers, operator, value);
        
        case "USER_AGENT":
            return evaluateStringCondition(context.headers?.["user-agent"], operator, value);
        
        default:
            logger.warn(`Unknown condition field: ${field}`);
            return false;
    }
}

/**
 * Condition evaluators for different field types
 */

function evaluateIpCondition(clientIp: string | undefined, operator: string, value: string): boolean {
    if (!clientIp) return false;
    
    switch (operator) {
        case "EQUALS":
            return clientIp === value;
        case "NOT_EQUALS":
            return clientIp !== value;
        case "IN":
            return value.split(",").map(v => v.trim()).includes(clientIp);
        case "NOT_IN":
            return !value.split(",").map(v => v.trim()).includes(clientIp);
        default:
            return false;
    }
}

function evaluateCidrCondition(clientIp: string | undefined, operator: string, value: string): boolean {
    if (!clientIp) return false;
    
    switch (operator) {
        case "EQUALS":
        case "IN":
            return isIpInCidr(clientIp, value);
        case "NOT_EQUALS":
        case "NOT_IN":
            return !isIpInCidr(clientIp, value);
        default:
            return false;
    }
}

async function evaluateCountryCondition(
    context: PolicyEvaluationContext,
    operator: string,
    value: string
): Promise<boolean> {
    let countryCode = context.countryCode;
    
    if (!countryCode && context.clientIp) {
        countryCode = await getCountryCodeForIp(context.clientIp);
    }
    
    if (!countryCode) return false;
    
    switch (operator) {
        case "EQUALS":
            return countryCode === value;
        case "NOT_EQUALS":
            return countryCode !== value;
        case "IN":
            return value.split(",").map(v => v.trim()).includes(countryCode);
        case "NOT_IN":
            return !value.split(",").map(v => v.trim()).includes(countryCode);
        default:
            return false;
    }
}

async function evaluateAsnCondition(
    context: PolicyEvaluationContext,
    operator: string,
    value: string
): Promise<boolean> {
    let asn = context.asn;
    
    if (asn === undefined && context.clientIp) {
        asn = await getAsnForIp(context.clientIp);
    }
    
    if (asn === undefined) return false;
    
    // Handle ALL ASNs special case
    if (value === "ALL" || value === "AS0") {
        return operator === "EQUALS" || operator === "IN";
    }
    
    // Normalize ASN format (remove AS prefix if present)
    const normalizedValue = value.replace(/^AS/i, "");
    const targetAsn = parseInt(normalizedValue, 10);
    
    if (isNaN(targetAsn)) return false;
    
    switch (operator) {
        case "EQUALS":
            return asn === targetAsn;
        case "NOT_EQUALS":
            return asn !== targetAsn;
        case "IN":
            return value.split(",").map(v => parseInt(v.replace(/^AS/i, ""), 10)).includes(asn);
        case "NOT_IN":
            return !value.split(",").map(v => parseInt(v.replace(/^AS/i, ""), 10)).includes(asn);
        default:
            return false;
    }
}

function evaluatePathCondition(path: string | undefined, operator: string, value: string): boolean {
    if (!path) return false;
    
    switch (operator) {
        case "EQUALS":
            return path === value;
        case "NOT_EQUALS":
            return path !== value;
        case "CONTAINS":
            return path.includes(value);
        case "NOT_CONTAINS":
            return !path.includes(value);
        case "MATCHES":
            try {
                return new RegExp(value).test(path);
            } catch {
                return false;
            }
        case "NOT_MATCHES":
            try {
                return !new RegExp(value).test(path);
            } catch {
                return false;
            }
        default:
            return false;
    }
}

function evaluateStringCondition(actual: string | undefined, operator: string, expected: string): boolean {
    if (!actual) return false;
    
    switch (operator) {
        case "EQUALS":
            return actual === expected;
        case "NOT_EQUALS":
            return actual !== expected;
        case "CONTAINS":
            return actual.includes(expected);
        case "NOT_CONTAINS":
            return !actual.includes(expected);
        case "MATCHES":
            try {
                return new RegExp(expected).test(actual);
            } catch {
                return false;
            }
        case "NOT_MATCHES":
            try {
                return !new RegExp(expected).test(actual);
            } catch {
                return false;
            }
        default:
            return false;
    }
}

function evaluateHeaderCondition(
    headers: Record<string, string> | undefined,
    operator: string,
    value: string
): boolean {
    if (!headers) return false;
    
    // Value format: "header-name:expected-value"
    const [headerName, expectedValue] = value.split(":", 2);
    if (!headerName) return false;
    
    const actualValue = headers[headerName.toLowerCase()];
    
    if (expectedValue === undefined) {
        // Just checking for header presence
        return operator === "EQUALS" ? actualValue !== undefined : actualValue === undefined;
    }
    
    return evaluateStringCondition(actualValue, operator, expectedValue);
}
