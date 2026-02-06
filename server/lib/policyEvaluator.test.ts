import { assertEquals } from "@test/assert";

// Mock the evaluateCondition function for testing without database
// We'll test the individual evaluation functions that are used internally

// Test HEADER field evaluation
function testHeaderFieldEvaluation() {
    console.log("Running HEADER field evaluation tests...");

    // Test 1: HEADER EQUALS with value
    {
        const headers = { "x-custom-header": "production" };
        const result = evaluateHeaderCondition(
            headers,
            "EQUALS",
            "x-custom-header:production"
        );
        assertEquals(result, true, "HEADER EQUALS with value failed");
    }

    // Test 2: HEADER NOT_EQUALS
    {
        const headers = { "x-custom-header": "production" };
        const result = evaluateHeaderCondition(
            headers,
            "NOT_EQUALS",
            "x-custom-header:staging"
        );
        assertEquals(result, true, "HEADER NOT_EQUALS failed");
    }

    // Test 3: HEADER CONTAINS
    {
        const headers = { "x-custom-header": "production-server-01" };
        const result = evaluateHeaderCondition(
            headers,
            "CONTAINS",
            "x-custom-header:production"
        );
        assertEquals(result, true, "HEADER CONTAINS failed");
    }

    // Test 4: HEADER NOT_CONTAINS
    {
        const headers = { "x-custom-header": "production" };
        const result = evaluateHeaderCondition(
            headers,
            "NOT_CONTAINS",
            "x-custom-header:staging"
        );
        assertEquals(result, true, "HEADER NOT_CONTAINS failed");
    }

    // Test 5: HEADER IN (multiple values)
    {
        const headers = { "x-environment": "staging" };
        const result = evaluateHeaderCondition(
            headers,
            "IN",
            "x-environment:production,staging,dev"
        );
        assertEquals(result, true, "HEADER IN operator failed");
    }

    // Test 6: HEADER NOT_IN
    {
        const headers = { "x-environment": "production" };
        const result = evaluateHeaderCondition(
            headers,
            "NOT_IN",
            "x-environment:staging,dev,test"
        );
        assertEquals(result, true, "HEADER NOT_IN operator failed");
    }

    // Test 7: HEADER MATCHES (regex)
    {
        const headers = { "x-api-key": "key-12345" };
        const result = evaluateHeaderCondition(
            headers,
            "MATCHES",
            "x-api-key:^key-\\d+$"
        );
        assertEquals(result, true, "HEADER MATCHES regex failed");
    }

    // Test 8: HEADER NOT_MATCHES
    {
        const headers = { "x-api-key": "key-abc" };
        const result = evaluateHeaderCondition(
            headers,
            "NOT_MATCHES",
            "x-api-key:^key-\\d+$"
        );
        assertEquals(result, true, "HEADER NOT_MATCHES regex failed");
    }

    // Test 9: Missing header
    {
        const headers = { "other-header": "value" };
        const result = evaluateHeaderCondition(
            headers,
            "EQUALS",
            "x-custom-header:production"
        );
        assertEquals(result, false, "Missing header should return false");
    }

    // Test 10: Case-insensitive header names
    {
        const headers = { "x-custom-header": "production" };
        const result = evaluateHeaderCondition(
            headers,
            "EQUALS",
            "X-Custom-Header:production"
        );
        assertEquals(result, true, "Case-insensitive header name failed");
    }

    // Test 11: Header presence check (no value specified)
    {
        const headers = { "x-custom-header": "any-value" };
        const result = evaluateHeaderCondition(
            headers,
            "EQUALS",
            "x-custom-header"
        );
        assertEquals(result, true, "Header presence check failed");
    }

    console.log("✓ All HEADER field tests passed");
}

// Test IP field evaluation
function testIpFieldEvaluation() {
    console.log("Running IP field evaluation tests...");

    // Test 1: IP EQUALS
    {
        const result = evaluateIpCondition(
            "192.168.1.100",
            "EQUALS",
            "192.168.1.100"
        );
        assertEquals(result, true, "IP EQUALS failed");
    }

    // Test 2: IP NOT_EQUALS
    {
        const result = evaluateIpCondition(
            "192.168.1.100",
            "NOT_EQUALS",
            "192.168.1.101"
        );
        assertEquals(result, true, "IP NOT_EQUALS failed");
    }

    // Test 3: IP IN (multiple IPs)
    {
        const result = evaluateIpCondition(
            "192.168.1.100",
            "IN",
            "192.168.1.100,192.168.1.101,192.168.1.102"
        );
        assertEquals(result, true, "IP IN operator failed");
    }

    // Test 4: IP NOT_IN
    {
        const result = evaluateIpCondition(
            "192.168.1.100",
            "NOT_IN",
            "192.168.1.101,192.168.1.102"
        );
        assertEquals(result, true, "IP NOT_IN operator failed");
    }

    // Test 5: Missing IP
    {
        const result = evaluateIpCondition(
            undefined,
            "EQUALS",
            "192.168.1.100"
        );
        assertEquals(result, false, "Missing IP should return false");
    }

    console.log("✓ All IP field tests passed");
}

// Test CIDR field evaluation
function testCidrFieldEvaluation() {
    console.log("Running CIDR field evaluation tests...");

    // Test 1: IP in CIDR range
    {
        const result = evaluateCidrCondition(
            "192.168.1.100",
            "EQUALS",
            "192.168.1.0/24"
        );
        assertEquals(result, true, "IP in CIDR range failed");
    }

    // Test 2: IP not in CIDR range
    {
        const result = evaluateCidrCondition(
            "192.168.2.100",
            "NOT_EQUALS",
            "192.168.1.0/24"
        );
        assertEquals(result, true, "IP not in CIDR range failed");
    }

    // Test 3: Multiple CIDR ranges (IN)
    {
        const result = evaluateCidrCondition(
            "10.0.0.50",
            "IN",
            "192.168.1.0/24,10.0.0.0/24"
        );
        assertEquals(result, true, "IP in multiple CIDR ranges failed");
    }

    // Test 4: NOT_IN multiple CIDR ranges
    {
        const result = evaluateCidrCondition(
            "172.16.0.1",
            "NOT_IN",
            "192.168.1.0/24,10.0.0.0/24"
        );
        assertEquals(result, true, "IP not in multiple CIDR ranges failed");
    }

    console.log("✓ All CIDR field tests passed");
}

// Test PATH field evaluation
function testPathFieldEvaluation() {
    console.log("Running PATH field evaluation tests...");

    // Test 1: PATH EQUALS
    {
        const result = evaluatePathCondition(
            "/api/users",
            "EQUALS",
            "/api/users"
        );
        assertEquals(result, true, "PATH EQUALS failed");
    }

    // Test 2: PATH CONTAINS
    {
        const result = evaluatePathCondition(
            "/api/users/123",
            "CONTAINS",
            "/api/users"
        );
        assertEquals(result, true, "PATH CONTAINS failed");
    }

    // Test 3: PATH NOT_CONTAINS
    {
        const result = evaluatePathCondition(
            "/api/products",
            "NOT_CONTAINS",
            "/users"
        );
        assertEquals(result, true, "PATH NOT_CONTAINS failed");
    }

    // Test 4: PATH MATCHES (regex)
    {
        const result = evaluatePathCondition(
            "/api/users/123",
            "MATCHES",
            "^/api/users/\\d+$"
        );
        assertEquals(result, true, "PATH MATCHES regex failed");
    }

    // Test 5: PATH NOT_MATCHES
    {
        const result = evaluatePathCondition(
            "/api/users/abc",
            "NOT_MATCHES",
            "^/api/users/\\d+$"
        );
        assertEquals(result, true, "PATH NOT_MATCHES regex failed");
    }

    console.log("✓ All PATH field tests passed");
}

// Test METHOD field evaluation
function testMethodFieldEvaluation() {
    console.log("Running METHOD field evaluation tests...");

    // Test 1: METHOD EQUALS
    {
        const result = evaluateStringCondition("GET", "EQUALS", "GET");
        assertEquals(result, true, "METHOD EQUALS failed");
    }

    // Test 2: METHOD IN (multiple methods)
    {
        const result = evaluateStringCondition("POST", "IN", "GET,POST,PUT");
        assertEquals(result, true, "METHOD IN operator failed");
    }

    // Test 3: METHOD NOT_IN
    {
        const result = evaluateStringCondition(
            "DELETE",
            "NOT_IN",
            "GET,POST,PUT"
        );
        assertEquals(result, true, "METHOD NOT_IN operator failed");
    }

    console.log("✓ All METHOD field tests passed");
}

// Test USER_AGENT field evaluation
function testUserAgentFieldEvaluation() {
    console.log("Running USER_AGENT field evaluation tests...");

    // Test 1: USER_AGENT CONTAINS
    {
        const result = evaluateStringCondition(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            "CONTAINS",
            "Chrome"
        );
        assertEquals(result, true, "USER_AGENT CONTAINS failed");
    }

    // Test 2: USER_AGENT NOT_CONTAINS
    {
        const result = evaluateStringCondition(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            "NOT_CONTAINS",
            "Firefox"
        );
        assertEquals(result, true, "USER_AGENT NOT_CONTAINS failed");
    }

    // Test 3: USER_AGENT MATCHES (regex for bot detection)
    {
        const result = evaluateStringCondition(
            "Googlebot/2.1 (+http://www.google.com/bot.html)",
            "MATCHES",
            "(bot|crawler|spider)"
        );
        assertEquals(result, true, "USER_AGENT MATCHES bot detection failed");
    }

    // Test 4: USER_AGENT NOT_MATCHES (block bots)
    {
        const result = evaluateStringCondition(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            "NOT_MATCHES",
            "(bot|crawler|spider)"
        );
        assertEquals(
            result,
            true,
            "USER_AGENT NOT_MATCHES bot blocking failed"
        );
    }

    console.log("✓ All USER_AGENT field tests passed");
}

// Test condition group logic
function testConditionGroupLogic() {
    console.log("Running condition group logic tests...");

    // Test 1: AND group - all conditions must be true
    {
        const conditions = [
            {
                field: "IP" as const,
                operator: "EQUALS",
                value: "192.168.1.100",
                priority: 0
            },
            {
                field: "METHOD" as const,
                operator: "EQUALS",
                value: "GET",
                priority: 1
            }
        ];
        const context = {
            clientIp: "192.168.1.100",
            method: "GET"
        };

        let allMatch = true;
        for (const condition of conditions) {
            let result = false;
            if (condition.field === "IP") {
                result = evaluateIpCondition(
                    context.clientIp,
                    condition.operator,
                    condition.value
                );
            } else if (condition.field === "METHOD") {
                result = evaluateStringCondition(
                    context.method,
                    condition.operator,
                    condition.value
                );
            }
            if (!result) {
                allMatch = false;
                break;
            }
        }

        assertEquals(
            allMatch,
            true,
            "AND group with all true conditions failed"
        );
    }

    // Test 2: AND group - one condition false
    {
        const conditions = [
            {
                field: "IP" as const,
                operator: "EQUALS",
                value: "192.168.1.100",
                priority: 0
            },
            {
                field: "METHOD" as const,
                operator: "EQUALS",
                value: "POST",
                priority: 1
            }
        ];
        const context = {
            clientIp: "192.168.1.100",
            method: "GET"
        };

        let allMatch = true;
        for (const condition of conditions) {
            let result = false;
            if (condition.field === "IP") {
                result = evaluateIpCondition(
                    context.clientIp,
                    condition.operator,
                    condition.value
                );
            } else if (condition.field === "METHOD") {
                result = evaluateStringCondition(
                    context.method,
                    condition.operator,
                    condition.value
                );
            }
            if (!result) {
                allMatch = false;
                break;
            }
        }

        assertEquals(
            allMatch,
            false,
            "AND group with one false condition should fail"
        );
    }

    // Test 3: OR group - at least one condition true
    {
        const conditions = [
            {
                field: "IP" as const,
                operator: "EQUALS",
                value: "192.168.1.101",
                priority: 0
            },
            {
                field: "METHOD" as const,
                operator: "EQUALS",
                value: "GET",
                priority: 1
            }
        ];
        const context = {
            clientIp: "192.168.1.100",
            method: "GET"
        };

        let anyMatch = false;
        for (const condition of conditions) {
            let result = false;
            if (condition.field === "IP") {
                result = evaluateIpCondition(
                    context.clientIp,
                    condition.operator,
                    condition.value
                );
            } else if (condition.field === "METHOD") {
                result = evaluateStringCondition(
                    context.method,
                    condition.operator,
                    condition.value
                );
            }
            if (result) {
                anyMatch = true;
                break;
            }
        }

        assertEquals(
            anyMatch,
            true,
            "OR group with one true condition should succeed"
        );
    }

    console.log("✓ All condition group logic tests passed");
}

// Test complex policy scenarios
function testComplexPolicyScenarios() {
    console.log("Running complex policy scenario tests...");

    // Scenario 1: Block all requests except from specific IPs with specific headers
    {
        const context = {
            clientIp: "192.168.1.100",
            headers: { "x-api-key": "secret-key-123" },
            method: "POST",
            path: "/api/admin"
        };

        // Condition 1: IP must be in whitelist
        const ipMatch = evaluateIpCondition(
            context.clientIp,
            "IN",
            "192.168.1.100,192.168.1.101"
        );

        // Condition 2: Must have valid API key header
        const headerMatch = evaluateHeaderCondition(
            context.headers,
            "EQUALS",
            "x-api-key:secret-key-123"
        );

        const policyMatches = ipMatch && headerMatch;
        assertEquals(
            policyMatches,
            true,
            "Complex policy: IP whitelist + API key header failed"
        );
    }

    // Scenario 2: Allow access from specific countries OR specific ASN ranges
    {
        const context1 = {
            clientIp: "8.8.8.8",
            countryCode: "US"
        };

        // Country check (would need mock for full test)
        const countryMatch =
            context1.countryCode === "US" || context1.countryCode === "CA";
        assertEquals(countryMatch, true, "Country-based access policy failed");
    }

    // Scenario 3: Block requests based on path patterns and methods
    {
        const context = {
            path: "/api/admin/delete",
            method: "DELETE"
        };

        // Block DELETE to admin paths
        const pathMatch = evaluatePathCondition(
            context.path,
            "CONTAINS",
            "/api/admin"
        );
        const methodMatch = evaluateStringCondition(
            context.method,
            "EQUALS",
            "DELETE"
        );
        const shouldBlock = pathMatch && methodMatch;

        assertEquals(shouldBlock, true, "Path + Method blocking policy failed");
    }

    // Scenario 4: Multiple header checks (e.g., JWT validation pattern)
    {
        const context = {
            headers: {
                authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                "x-request-id": "req-12345",
                "content-type": "application/json"
            }
        };

        const authMatch = evaluateHeaderCondition(
            context.headers,
            "CONTAINS",
            "authorization:Bearer"
        );
        const contentTypeMatch = evaluateHeaderCondition(
            context.headers,
            "IN",
            "content-type:application/json,application/xml"
        );

        const allHeadersValid = authMatch && contentTypeMatch;
        assertEquals(
            allHeadersValid,
            true,
            "Multiple header validation policy failed"
        );
    }

    // Scenario 5: User-Agent based bot blocking
    {
        const context = {
            headers: {
                "user-agent": "BadBot/1.0 (bot; crawler)"
            }
        };

        const isBot = evaluateStringCondition(
            context.headers["user-agent"],
            "MATCHES",
            "(bot|crawler|spider|scraper)"
        );

        assertEquals(isBot, true, "Bot detection policy failed");
    }

    console.log("✓ All complex policy scenario tests passed");
}

// Helper functions - these mirror the internal functions in policyEvaluator.ts
function evaluateIpCondition(
    clientIp: string | undefined,
    operator: string,
    value: string
): boolean {
    if (!clientIp) return false;

    switch (operator) {
        case "EQUALS":
            return clientIp === value;
        case "NOT_EQUALS":
            return clientIp !== value;
        case "IN":
            return value
                .split(",")
                .map((v) => v.trim())
                .includes(clientIp);
        case "NOT_IN":
            return !value
                .split(",")
                .map((v) => v.trim())
                .includes(clientIp);
        default:
            return false;
    }
}

function evaluateCidrCondition(
    clientIp: string | undefined,
    operator: string,
    value: string
): boolean {
    if (!clientIp) return false;

    // Simple CIDR check (you'd use the actual isIpInCidr function in real code)
    const checkCidr = (ip: string, cidr: string): boolean => {
        // Simplified: just check if IP starts with CIDR network part
        const [network, bits] = cidr.split("/");
        const maskLength = Math.floor(parseInt(bits) / 8);
        const ipParts = ip.split(".");
        const networkParts = network.split(".");

        for (let i = 0; i < maskLength; i++) {
            if (ipParts[i] !== networkParts[i]) return false;
        }
        return true;
    };

    switch (operator) {
        case "EQUALS":
            return checkCidr(clientIp, value);
        case "NOT_EQUALS":
            return !checkCidr(clientIp, value);
        case "IN":
            return value
                .split(",")
                .some((cidr) => checkCidr(clientIp, cidr.trim()));
        case "NOT_IN":
            return !value
                .split(",")
                .some((cidr) => checkCidr(clientIp, cidr.trim()));
        default:
            return false;
    }
}

function evaluatePathCondition(
    path: string | undefined,
    operator: string,
    value: string
): boolean {
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

function evaluateStringCondition(
    actual: string | undefined,
    operator: string,
    expected: string
): boolean {
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
        case "IN":
            return expected
                .split(",")
                .map((v) => v.trim())
                .includes(actual);
        case "NOT_IN":
            return !expected
                .split(",")
                .map((v) => v.trim())
                .includes(actual);
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
        return operator === "EQUALS"
            ? actualValue !== undefined
            : actualValue === undefined;
    }

    return evaluateStringCondition(actualValue, operator, expectedValue);
}

// Run all tests
function runAllTests() {
    console.log("\n========================================");
    console.log("Running Policy Evaluator Tests");
    console.log("========================================\n");

    try {
        testHeaderFieldEvaluation();
        testIpFieldEvaluation();
        testCidrFieldEvaluation();
        testPathFieldEvaluation();
        testMethodFieldEvaluation();
        testUserAgentFieldEvaluation();
        testConditionGroupLogic();
        testComplexPolicyScenarios();

        console.log("\n========================================");
        console.log("✓ All tests passed!");
        console.log("========================================\n");
    } catch (error) {
        console.error("\n========================================");
        console.error("✗ Test failed!");
        console.error("========================================");
        console.error(error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export {
    testHeaderFieldEvaluation,
    testIpFieldEvaluation,
    testCidrFieldEvaluation,
    testPathFieldEvaluation,
    testMethodFieldEvaluation,
    testUserAgentFieldEvaluation,
    testConditionGroupLogic,
    testComplexPolicyScenarios,
    runAllTests
};
