"use client";

import { use, useEffect, useState } from "react";
import { useResourceContext } from "@app/hooks/useResourceContext";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useParams } from "next/navigation";
import { toast } from "@app/hooks/useToast";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody
} from "@app/components/Settings";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import { Badge } from "@app/components/ui/badge";
import { Button } from "@app/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Policy {
    policyId: number;
    name: string;
    description?: string;
    enabled: boolean;
    action: "ACCEPT" | "DROP" | "PASS";
    scope: "ORGANIZATION" | "RESOURCE";
}

export default function ResourcePolicies() {
    const { resource } = useResourceContext();
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const params = useParams();
    const t = useTranslations();

    const [policies, setPolicies] = useState<Policy[]>([]);
    const [orgWidePolicies, setOrgWidePolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPolicies();
    }, []);

    async function loadPolicies() {
        try {
            // Get all policies for the org
            const res = await api.get(`/${params.orgId}/policies`);
            if (res.status === 200) {
                const allPolicies = res.data.data.policies;

                // Separate org-wide and resource-specific policies
                const orgWide = allPolicies.filter(
                    (p: Policy) => p.scope === "ORGANIZATION"
                );
                setOrgWidePolicies(orgWide);

                // Get resource-specific policies assigned to this resource
                const resourceSpecific: Policy[] = [];
                for (const policy of allPolicies) {
                    if (policy.scope === "RESOURCE") {
                        try {
                            const resourcesRes = await api.get(
                                `/${params.orgId}/policies/${policy.policyId}/resources`
                            );
                            if (resourcesRes.status === 200) {
                                const assignedResources =
                                    resourcesRes.data.data.resources;
                                if (
                                    assignedResources.some(
                                        (r: any) =>
                                            r.resourceId === resource.resourceId
                                    )
                                ) {
                                    resourceSpecific.push(policy);
                                }
                            }
                        } catch (error) {
                            console.error(
                                `Error loading resources for policy ${policy.policyId}:`,
                                error
                            );
                        }
                    }
                }
                setPolicies(resourceSpecific);
            }
        } catch (error) {
            console.error("Error loading policies:", error);
            toast({
                title: "Error",
                description: "Failed to load policies",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }

    const PolicyAction = {
        ACCEPT: "Allow",
        DROP: "Block",
        PASS: "Skip to Auth"
    };

    if (loading) {
        return (
            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionBody>
                        <div className="text-center py-8 text-muted-foreground">
                            Loading policies...
                        </div>
                    </SettingsSectionBody>
                </SettingsSection>
            </SettingsContainer>
        );
    }

    return (
        <SettingsContainer>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>Access Policies</SettingsSectionTitle>
                    <SettingsSectionDescription>
                        Policies control access to this resource based on
                        various conditions like IP address, country, ASN, and
                        more. Organization-wide policies apply automatically,
                        while resource-specific policies must be explicitly
                        assigned.
                    </SettingsSectionDescription>
                </SettingsSectionHeader>
                <SettingsSectionBody>
                    <div className="space-y-6">
                        {/* Organization-Wide Policies */}
                        {orgWidePolicies.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium mb-3">
                                    Organization-Wide Policies (
                                    {orgWidePolicies.length})
                                </h3>
                                <div className="text-sm text-muted-foreground mb-3">
                                    These policies automatically apply to all
                                    resources in your organization.
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orgWidePolicies.map((policy) => (
                                            <TableRow key={policy.policyId}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">
                                                            {policy.name}
                                                        </div>
                                                        {policy.description && (
                                                            <div className="text-sm text-muted-foreground">
                                                                {
                                                                    policy.description
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            policy.action ===
                                                            "ACCEPT"
                                                                ? "default"
                                                                : policy.action ===
                                                                    "DROP"
                                                                  ? "destructive"
                                                                  : "secondary"
                                                        }
                                                    >
                                                        {
                                                            PolicyAction[
                                                                policy.action
                                                            ]
                                                        }
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            policy.enabled
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {policy.enabled
                                                            ? "Enabled"
                                                            : "Disabled"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Resource-Specific Policies */}
                        <div>
                            <h3 className="text-sm font-medium mb-3">
                                Resource-Specific Policies ({policies.length})
                            </h3>
                            <div className="text-sm text-muted-foreground mb-3">
                                These policies are specifically assigned to this
                                resource.
                            </div>
                            {policies.length === 0 ? (
                                <div className="border rounded-md p-8 text-center text-muted-foreground">
                                    No resource-specific policies assigned to
                                    this resource.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {policies.map((policy) => (
                                            <TableRow key={policy.policyId}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">
                                                            {policy.name}
                                                        </div>
                                                        {policy.description && (
                                                            <div className="text-sm text-muted-foreground">
                                                                {
                                                                    policy.description
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            policy.action ===
                                                            "ACCEPT"
                                                                ? "default"
                                                                : policy.action ===
                                                                    "DROP"
                                                                  ? "destructive"
                                                                  : "secondary"
                                                        }
                                                    >
                                                        {
                                                            PolicyAction[
                                                                policy.action
                                                            ]
                                                        }
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            policy.enabled
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {policy.enabled
                                                            ? "Enabled"
                                                            : "Disabled"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        {/* Link to manage policies */}
                        <div className="pt-4">
                            <Link
                                href={`/${params.orgId}/settings/access/policies`}
                            >
                                <Button variant="outline">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Manage All Policies
                                </Button>
                            </Link>
                        </div>
                    </div>
                </SettingsSectionBody>
            </SettingsSection>
        </SettingsContainer>
    );
}
