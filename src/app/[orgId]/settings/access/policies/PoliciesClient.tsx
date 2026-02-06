"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@app/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@app/components/ui/dialog";
import { Input } from "@app/components/ui/input";
import { Label } from "@app/components/ui/label";
import { Textarea } from "@app/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { Badge } from "@app/components/ui/badge";
import { Switch } from "@app/components/ui/switch";
import { Checkbox } from "@app/components/ui/checkbox";
import {
    Plus,
    Trash2,
    Edit,
    Check,
    ChevronsUpDown,
    GripVertical,
    ExternalLink
} from "lucide-react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { useTranslations } from "next-intl";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@app/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@app/components/ui/command";
import { COUNTRIES } from "@server/db/countries";
import { MAJOR_ASNS } from "@server/db/asns";

interface Policy {
    policyId: number;
    name: string;
    description?: string;
    enabled: boolean;
    action: "ACCEPT" | "DROP" | "PASS";
    scope: "ORGANIZATION" | "RESOURCE";
    priority: number;
    createdAt: string;
    updatedAt: string;
    resourceCount: number;
}

interface Condition {
    field:
        | "IP"
        | "COUNTRY"
        | "ASN"
        | "CIDR"
        | "PATH"
        | "HEADER"
        | "METHOD"
        | "USER_AGENT";
    operator:
        | "EQUALS"
        | "NOT_EQUALS"
        | "CONTAINS"
        | "NOT_CONTAINS"
        | "IN"
        | "NOT_IN"
        | "MATCHES"
        | "NOT_MATCHES";
    value: string;
    priority: number;
}

interface ConditionGroup {
    operator: "AND" | "OR";
    conditions: Condition[];
    priority: number;
}

interface PoliciesClientProps {
    initialPolicies: Policy[];
}

export default function PoliciesClient({
    initialPolicies
}: PoliciesClientProps) {
    const params = useParams<{ orgId: string }>();
    const api = createApiClient(useEnvContext());
    const t = useTranslations();
    const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
    const [loading, setLoading] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
    const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [allResources, setAllResources] = useState<any[]>([]);
    const [assignedResourceIds, setAssignedResourceIds] = useState<number[]>(
        []
    );
    const [loadingResources, setLoadingResources] = useState(false);
    const [draggedPolicy, setDraggedPolicy] = useState<Policy | null>(null);

    const PolicyAction = {
        ACCEPT: t("alwaysAllow"),
        DROP: t("alwaysDeny"),
        PASS: t("passToAuth")
    } as const;

    const [newPolicy, setNewPolicy] = useState({
        name: "",
        description: "",
        action: "ACCEPT" as "ACCEPT" | "DROP" | "PASS",
        scope: "RESOURCE" as "ORGANIZATION" | "RESOURCE",
        priority: 0,
        enabled: true
    });
    const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>([
        {
            operator: "AND",
            conditions: [
                { field: "COUNTRY", operator: "EQUALS", value: "", priority: 0 }
            ],
            priority: 0
        }
    ]);

    async function loadPolicies() {
        try {
            setLoading(true);
            const res = await api.get(`/${params.orgId}/policies`);
            if (res.status === 200) {
                setPolicies(res.data.data.policies);
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load policies",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }

    async function createPolicy() {
        try {
            const res = await api.put(`/${params.orgId}/policies`, {
                ...newPolicy,
                conditionGroups
            });

            if (res.status === 200) {
                toast({
                    title: "Success",
                    description: "Policy created successfully"
                });
                setIsCreateDialogOpen(false);
                resetForm();
                loadPolicies();
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description:
                    error.response?.data?.message || "Failed to create policy",
                variant: "destructive"
            });
        }
    }

    async function updatePolicy() {
        if (!editingPolicy) return;

        try {
            const res = await api.post(
                `/${params.orgId}/policies/${editingPolicy.policyId}`,
                {
                    ...newPolicy,
                    conditionGroups
                }
            );

            if (res.status === 200) {
                toast({
                    title: "Success",
                    description: "Policy updated successfully"
                });
                setIsCreateDialogOpen(false);
                setEditingPolicy(null);
                resetForm();
                loadPolicies();
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description:
                    error.response?.data?.message || "Failed to update policy",
                variant: "destructive"
            });
        }
    }

    async function togglePolicyEnabled(policyId: number, enabled: boolean) {
        try {
            const policy = policies.find((p) => p.policyId === policyId);
            if (!policy) return;

            await api.post(`/${params.orgId}/policies/${policyId}`, {
                enabled
            });

            setPolicies(
                policies.map((p) =>
                    p.policyId === policyId ? { ...p, enabled } : p
                )
            );

            toast({
                title: "Success",
                description: `Policy ${enabled ? "enabled" : "disabled"}`
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update policy",
                variant: "destructive"
            });
        }
    }

    async function deletePolicy(policyId: number) {
        if (!confirm("Are you sure you want to delete this policy?")) return;

        try {
            await api.delete(`/${params.orgId}/policies/${policyId}`);
            toast({
                title: "Success",
                description: "Policy deleted"
            });
            loadPolicies();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete policy",
                variant: "destructive"
            });
        }
    }

    function openEditDialog(policy: Policy) {
        setEditingPolicy(policy);
        setNewPolicy({
            name: policy.name,
            description: policy.description || "",
            action: policy.action,
            scope: policy.scope,
            priority: policy.priority,
            enabled: policy.enabled
        });

        // Load policy conditions
        loadPolicyConditions(policy.policyId);
        setIsCreateDialogOpen(true);
    }

    async function loadPolicyConditions(policyId: number) {
        try {
            const res = await api.get(`/${params.orgId}/policies/${policyId}`);
            if (res.status === 200 && res.data.data.policy.conditionGroups) {
                setConditionGroups(res.data.data.policy.conditionGroups);
            }
        } catch (error) {
            console.error("Failed to load policy conditions:", error);
        }
    }

    async function openResourceDialog(policy: Policy) {
        // Skip for organization-wide policies
        if (policy.scope === "ORGANIZATION") {
            toast({
                title: "Organization-Wide Policy",
                description:
                    "This policy automatically applies to all resources"
            });
            return;
        }

        setSelectedPolicy(policy);
        setLoadingResources(true);
        setIsResourceDialogOpen(true);

        try {
            // Load all org resources
            const resourcesRes = await api.get(
                `/org/${params.orgId}/resources`
            );
            if (resourcesRes.status === 200) {
                setAllResources(resourcesRes.data.data.resources);
            }

            // Load assigned resources for this policy
            const assignedRes = await api.get(
                `/${params.orgId}/policies/${policy.policyId}/resources`
            );
            if (assignedRes.status === 200) {
                setAssignedResourceIds(
                    assignedRes.data.data.resources.map(
                        (r: any) => r.resourceId
                    )
                );
            }
        } catch (error) {
            console.error("Failed to load resources:", error);
            toast({
                title: "Error",
                description: "Failed to load resources",
                variant: "destructive"
            });
        } finally {
            setLoadingResources(false);
        }
    }

    async function saveResourceAssignments() {
        if (!selectedPolicy) return;

        try {
            await api.post(
                `/${params.orgId}/policies/${selectedPolicy.policyId}/resources`,
                { resourceIds: assignedResourceIds }
            );

            toast({
                title: "Success",
                description: "Resource assignments updated"
            });

            setIsResourceDialogOpen(false);
            loadPolicies();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update resource assignments",
                variant: "destructive"
            });
        }
    }

    function toggleResourceAssignment(resourceId: number) {
        setAssignedResourceIds((prev) =>
            prev.includes(resourceId)
                ? prev.filter((id) => id !== resourceId)
                : [...prev, resourceId]
        );
    }

    function selectAllResources() {
        setAssignedResourceIds(allResources.map((r) => r.resourceId));
    }

    function clearAllResources() {
        setAssignedResourceIds([]);
    }

    function handleDragStart(policy: Policy) {
        setDraggedPolicy(policy);
    }

    function handleDragOver(e: React.DragEvent, targetPolicy: Policy) {
        e.preventDefault();
        if (!draggedPolicy || draggedPolicy.policyId === targetPolicy.policyId)
            return;

        const draggedIndex = policies.findIndex(
            (p) => p.policyId === draggedPolicy.policyId
        );
        const targetIndex = policies.findIndex(
            (p) => p.policyId === targetPolicy.policyId
        );

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newPolicies = [...policies];
        const [removed] = newPolicies.splice(draggedIndex, 1);
        newPolicies.splice(targetIndex, 0, removed);

        // Update priorities based on new order
        const updatedPolicies = newPolicies.map((policy, index) => ({
            ...policy,
            priority: index
        }));

        setPolicies(updatedPolicies);
    }

    async function handleDragEnd() {
        if (!draggedPolicy) return;

        try {
            // Update all policy priorities on the backend
            await Promise.all(
                policies.map((policy) =>
                    api.post(`/${params.orgId}/policies/${policy.policyId}`, {
                        priority: policy.priority
                    })
                )
            );

            toast({
                title: "Success",
                description: "Policy order updated"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update policy order",
                variant: "destructive"
            });
            // Reload to get correct order
            loadPolicies();
        } finally {
            setDraggedPolicy(null);
        }
    }

    function resetForm() {
        setNewPolicy({
            name: "",
            description: "",
            action: "ACCEPT",
            priority: 0,
            enabled: true,
            scope: "RESOURCE" as "ORGANIZATION" | "RESOURCE"
        });
        setConditionGroups([
            {
                operator: "AND",
                conditions: [
                    {
                        field: "COUNTRY",
                        operator: "EQUALS",
                        value: "",
                        priority: 0
                    }
                ],
                priority: 0
            }
        ]);
        setEditingPolicy(null);
    }

    function addConditionGroup() {
        setConditionGroups([
            ...conditionGroups,
            {
                operator: "AND",
                conditions: [
                    {
                        field: "COUNTRY",
                        operator: "EQUALS",
                        value: "",
                        priority: 0
                    }
                ],
                priority: conditionGroups.length
            }
        ]);
    }

    function addCondition(groupIndex: number) {
        const groups = [...conditionGroups];
        groups[groupIndex].conditions.push({
            field: "COUNTRY",
            operator: "EQUALS",
            value: "",
            priority: groups[groupIndex].conditions.length
        });
        setConditionGroups(groups);
    }

    function updateCondition(
        groupIndex: number,
        conditionIndex: number,
        updates: Partial<Condition>
    ) {
        const groups = [...conditionGroups];
        groups[groupIndex].conditions[conditionIndex] = {
            ...groups[groupIndex].conditions[conditionIndex],
            ...updates
        };
        setConditionGroups(groups);
    }

    function removeCondition(groupIndex: number, conditionIndex: number) {
        const groups = [...conditionGroups];
        groups[groupIndex].conditions.splice(conditionIndex, 1);
        if (groups[groupIndex].conditions.length === 0) {
            groups.splice(groupIndex, 1);
        }
        setConditionGroups(groups);
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <SettingsSectionTitle
                    title="Access Policies"
                    description="Create complex access rules with AND/OR logic"
                />
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Policy
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resources</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {policies.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="text-center text-muted-foreground"
                            >
                                No policies configured
                            </TableCell>
                        </TableRow>
                    ) : (
                        policies.map((policy) => (
                            <TableRow
                                key={policy.policyId}
                                draggable
                                onDragStart={() => handleDragStart(policy)}
                                onDragOver={(e) => handleDragOver(e, policy)}
                                onDragEnd={handleDragEnd}
                                className={`cursor-move ${draggedPolicy?.policyId === policy.policyId ? "opacity-50" : ""}`}
                            >
                                <TableCell>
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </TableCell>
                                <TableCell>
                                    <div>
                                        <div className="font-medium">
                                            {policy.name}
                                        </div>
                                        {policy.description && (
                                            <div className="text-sm text-muted-foreground">
                                                {policy.description}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            policy.action === "ACCEPT"
                                                ? "default"
                                                : policy.action === "DROP"
                                                  ? "destructive"
                                                  : "secondary"
                                        }
                                    >
                                        {PolicyAction[policy.action]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {policy.scope === "ORGANIZATION" ? (
                                        <span className="text-sm text-muted-foreground">
                                            Organization-Wide
                                        </span>
                                    ) : (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0"
                                            onClick={() =>
                                                openResourceDialog(policy)
                                            }
                                        >
                                            {policy.resourceCount === 0
                                                ? "No resources"
                                                : `${policy.resourceCount} resource${policy.resourceCount === 1 ? "" : "s"}`}
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={policy.enabled}
                                        onCheckedChange={(checked) =>
                                            togglePolicyEnabled(
                                                policy.policyId,
                                                checked
                                            )
                                        }
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                openEditDialog(policy)
                                            }
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                deletePolicy(policy.policyId)
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPolicy
                                ? "Edit Access Policy"
                                : "Create Access Policy"}
                        </DialogTitle>
                        <DialogDescription>
                            Define conditions that must be met for this policy
                            to apply
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Policy Name</Label>
                            <Input
                                value={newPolicy.name}
                                onChange={(e) =>
                                    setNewPolicy({
                                        ...newPolicy,
                                        name: e.target.value
                                    })
                                }
                                placeholder="e.g., US T-Mobile Only"
                            />
                        </div>

                        <div>
                            <Label className="mb-2">
                                Description (Optional)
                            </Label>
                            <Textarea
                                value={newPolicy.description}
                                onChange={(e) =>
                                    setNewPolicy({
                                        ...newPolicy,
                                        description: e.target.value
                                    })
                                }
                                placeholder="Describe what this policy does"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="mb-2">Action</Label>
                                <Select
                                    value={newPolicy.action}
                                    onValueChange={(value: any) =>
                                        setNewPolicy({
                                            ...newPolicy,
                                            action: value
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACCEPT">
                                            {PolicyAction.ACCEPT}
                                        </SelectItem>
                                        <SelectItem value="DROP">
                                            {PolicyAction.DROP}
                                        </SelectItem>
                                        <SelectItem value="PASS">
                                            {PolicyAction.PASS}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="mb-2">Scope</Label>
                                <Select
                                    value={newPolicy.scope}
                                    onValueChange={(value: any) =>
                                        setNewPolicy({
                                            ...newPolicy,
                                            scope: value
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RESOURCE">
                                            Resource-Specific
                                        </SelectItem>
                                        <SelectItem value="ORGANIZATION">
                                            Organization-Wide
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={newPolicy.enabled}
                                        onChange={(e) =>
                                            setNewPolicy({
                                                ...newPolicy,
                                                enabled: e.target.checked
                                            })
                                        }
                                        className="rounded"
                                    />
                                    <span>Enabled</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-base mb-2">
                                    Conditions
                                </Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addConditionGroup}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Group (AND)
                                </Button>
                            </div>

                            {conditionGroups.map((group, groupIndex) => (
                                <div
                                    key={groupIndex}
                                    className="border rounded-lg p-4 space-y-3"
                                >
                                    <div className="flex justify-between items-center">
                                        <Label className="text-sm font-semibold">
                                            Group {groupIndex + 1} (
                                            {group.operator})
                                        </Label>
                                        <Select
                                            value={group.operator}
                                            onValueChange={(
                                                value: "AND" | "OR"
                                            ) => {
                                                const groups = [
                                                    ...conditionGroups
                                                ];
                                                groups[groupIndex].operator =
                                                    value;
                                                setConditionGroups(groups);
                                            }}
                                        >
                                            <SelectTrigger className="w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AND">
                                                    AND
                                                </SelectItem>
                                                <SelectItem value="OR">
                                                    OR
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {group.conditions.map(
                                        (condition, conditionIndex) => (
                                            <div
                                                key={conditionIndex}
                                                className="grid grid-cols-4 gap-2 items-end"
                                            >
                                                <div>
                                                    <Label className="text-xs mb-1">
                                                        Field
                                                    </Label>
                                                    <Select
                                                        value={condition.field}
                                                        onValueChange={(
                                                            value: any
                                                        ) =>
                                                            updateCondition(
                                                                groupIndex,
                                                                conditionIndex,
                                                                { field: value }
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="IP">
                                                                IP
                                                            </SelectItem>
                                                            <SelectItem value="COUNTRY">
                                                                Country
                                                            </SelectItem>
                                                            <SelectItem value="ASN">
                                                                ASN
                                                            </SelectItem>
                                                            <SelectItem value="CIDR">
                                                                CIDR
                                                            </SelectItem>
                                                            <SelectItem value="PATH">
                                                                Path
                                                            </SelectItem>
                                                            <SelectItem value="METHOD">
                                                                Method
                                                            </SelectItem>
                                                            <SelectItem value="HEADER">
                                                                Header
                                                            </SelectItem>
                                                            <SelectItem value="USER_AGENT">
                                                                User Agent
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div>
                                                    <Label className="text-xs mb-1">
                                                        Operator
                                                    </Label>
                                                    <Select
                                                        value={
                                                            condition.operator
                                                        }
                                                        onValueChange={(
                                                            value: any
                                                        ) =>
                                                            updateCondition(
                                                                groupIndex,
                                                                conditionIndex,
                                                                {
                                                                    operator:
                                                                        value
                                                                }
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="EQUALS">
                                                                Equals
                                                            </SelectItem>
                                                            <SelectItem value="NOT_EQUALS">
                                                                Not Equals
                                                            </SelectItem>
                                                            <SelectItem value="CONTAINS">
                                                                Contains
                                                            </SelectItem>
                                                            <SelectItem value="NOT_CONTAINS">
                                                                Not Contains
                                                            </SelectItem>
                                                            <SelectItem value="IN">
                                                                In
                                                            </SelectItem>
                                                            <SelectItem value="NOT_IN">
                                                                Not In
                                                            </SelectItem>
                                                            <SelectItem value="MATCHES">
                                                                Matches (Regex)
                                                            </SelectItem>
                                                            <SelectItem value="NOT_MATCHES">
                                                                Not Matches
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div>
                                                    <Label className="text-xs mb-1">
                                                        Value
                                                    </Label>
                                                    {condition.field ===
                                                    "COUNTRY" ? (
                                                        condition.operator ===
                                                            "IN" ||
                                                        condition.operator ===
                                                            "NOT_IN" ? (
                                                            <Popover>
                                                                <PopoverTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        className="w-full justify-start h-auto min-h-[40px]"
                                                                    >
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {condition.value ? (
                                                                                condition.value
                                                                                    .split(
                                                                                        ","
                                                                                    )
                                                                                    .filter(
                                                                                        Boolean
                                                                                    )
                                                                                    .map(
                                                                                        (
                                                                                            code
                                                                                        ) => {
                                                                                            const country =
                                                                                                COUNTRIES.find(
                                                                                                    (
                                                                                                        c
                                                                                                    ) =>
                                                                                                        c.code ===
                                                                                                        code
                                                                                                );
                                                                                            return (
                                                                                                <Badge
                                                                                                    key={
                                                                                                        code
                                                                                                    }
                                                                                                    variant="secondary"
                                                                                                    className="text-xs"
                                                                                                >
                                                                                                    {country
                                                                                                        ? country.name
                                                                                                        : code}
                                                                                                </Badge>
                                                                                            );
                                                                                        }
                                                                                    )
                                                                            ) : (
                                                                                <span className="text-muted-foreground">
                                                                                    Select
                                                                                    countries...
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0">
                                                                    <Command>
                                                                        <CommandInput
                                                                            placeholder={t(
                                                                                "searchCountries"
                                                                            )}
                                                                        />
                                                                        <CommandList>
                                                                            <CommandEmpty>
                                                                                {t(
                                                                                    "noCountryFound"
                                                                                )}
                                                                            </CommandEmpty>
                                                                            <CommandGroup>
                                                                                {COUNTRIES.map(
                                                                                    (
                                                                                        country
                                                                                    ) => {
                                                                                        const selected =
                                                                                            condition.value
                                                                                                .split(
                                                                                                    ","
                                                                                                )
                                                                                                .includes(
                                                                                                    country.code
                                                                                                );
                                                                                        return (
                                                                                            <CommandItem
                                                                                                key={
                                                                                                    country.code
                                                                                                }
                                                                                                value={
                                                                                                    country.name
                                                                                                }
                                                                                                onSelect={() => {
                                                                                                    const values =
                                                                                                        condition.value
                                                                                                            .split(
                                                                                                                ","
                                                                                                            )
                                                                                                            .filter(
                                                                                                                Boolean
                                                                                                            );
                                                                                                    const newValues =
                                                                                                        selected
                                                                                                            ? values.filter(
                                                                                                                  (
                                                                                                                      v
                                                                                                                  ) =>
                                                                                                                      v !==
                                                                                                                      country.code
                                                                                                              )
                                                                                                            : [
                                                                                                                  ...values,
                                                                                                                  country.code
                                                                                                              ];
                                                                                                    updateCondition(
                                                                                                        groupIndex,
                                                                                                        conditionIndex,
                                                                                                        {
                                                                                                            value: newValues.join(
                                                                                                                ","
                                                                                                            )
                                                                                                        }
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <Check
                                                                                                    className={`mr-2 h-4 w-4 ${
                                                                                                        selected
                                                                                                            ? "opacity-100"
                                                                                                            : "opacity-0"
                                                                                                    }`}
                                                                                                />
                                                                                                {
                                                                                                    country.name
                                                                                                }{" "}
                                                                                                (
                                                                                                {
                                                                                                    country.code
                                                                                                }

                                                                                                )
                                                                                            </CommandItem>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        ) : (
                                                            <Popover>
                                                                <PopoverTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        className="w-full justify-between"
                                                                    >
                                                                        {condition.value
                                                                            ? COUNTRIES.find(
                                                                                  (
                                                                                      country
                                                                                  ) =>
                                                                                      country.code ===
                                                                                      condition.value
                                                                              )
                                                                                  ?.name +
                                                                              " (" +
                                                                              condition.value +
                                                                              ")"
                                                                            : t(
                                                                                  "selectCountry"
                                                                              )}
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0">
                                                                    <Command>
                                                                        <CommandInput
                                                                            placeholder={t(
                                                                                "searchCountries"
                                                                            )}
                                                                        />
                                                                        <CommandList>
                                                                            <CommandEmpty>
                                                                                {t(
                                                                                    "noCountryFound"
                                                                                )}
                                                                            </CommandEmpty>
                                                                            <CommandGroup>
                                                                                {COUNTRIES.map(
                                                                                    (
                                                                                        country
                                                                                    ) => (
                                                                                        <CommandItem
                                                                                            key={
                                                                                                country.code
                                                                                            }
                                                                                            value={
                                                                                                country.name
                                                                                            }
                                                                                            onSelect={() => {
                                                                                                updateCondition(
                                                                                                    groupIndex,
                                                                                                    conditionIndex,
                                                                                                    {
                                                                                                        value: country.code
                                                                                                    }
                                                                                                );
                                                                                            }}
                                                                                        >
                                                                                            <Check
                                                                                                className={`mr-2 h-4 w-4 ${
                                                                                                    condition.value ===
                                                                                                    country.code
                                                                                                        ? "opacity-100"
                                                                                                        : "opacity-0"
                                                                                                }`}
                                                                                            />
                                                                                            {
                                                                                                country.name
                                                                                            }{" "}
                                                                                            (
                                                                                            {
                                                                                                country.code
                                                                                            }

                                                                                            )
                                                                                        </CommandItem>
                                                                                    )
                                                                                )}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )
                                                    ) : condition.field ===
                                                      "ASN" ? (
                                                        condition.operator ===
                                                            "IN" ||
                                                        condition.operator ===
                                                            "NOT_IN" ? (
                                                            <Popover>
                                                                <PopoverTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        className="w-full justify-start h-auto min-h-[40px]"
                                                                    >
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {condition.value ? (
                                                                                condition.value
                                                                                    .split(
                                                                                        ","
                                                                                    )
                                                                                    .filter(
                                                                                        Boolean
                                                                                    )
                                                                                    .map(
                                                                                        (
                                                                                            code
                                                                                        ) => {
                                                                                            const asn =
                                                                                                MAJOR_ASNS.find(
                                                                                                    (
                                                                                                        a
                                                                                                    ) =>
                                                                                                        a.code ===
                                                                                                        code
                                                                                                );
                                                                                            return (
                                                                                                <Badge
                                                                                                    key={
                                                                                                        code
                                                                                                    }
                                                                                                    variant="secondary"
                                                                                                    className="text-xs"
                                                                                                >
                                                                                                    {asn
                                                                                                        ? asn.name
                                                                                                        : code}
                                                                                                </Badge>
                                                                                            );
                                                                                        }
                                                                                    )
                                                                            ) : (
                                                                                <span className="text-muted-foreground">
                                                                                    Select
                                                                                    ASNs...
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0">
                                                                    <Command>
                                                                        <CommandInput placeholder="Search ASNs..." />
                                                                        <CommandList>
                                                                            <CommandEmpty>
                                                                                No
                                                                                ASN
                                                                                found.
                                                                            </CommandEmpty>
                                                                            <CommandGroup>
                                                                                {MAJOR_ASNS.map(
                                                                                    (
                                                                                        asn
                                                                                    ) => {
                                                                                        const selected =
                                                                                            condition.value
                                                                                                .split(
                                                                                                    ","
                                                                                                )
                                                                                                .includes(
                                                                                                    asn.code
                                                                                                );
                                                                                        return (
                                                                                            <CommandItem
                                                                                                key={
                                                                                                    asn.code
                                                                                                }
                                                                                                value={
                                                                                                    asn.name +
                                                                                                    " " +
                                                                                                    asn.code
                                                                                                }
                                                                                                onSelect={() => {
                                                                                                    const values =
                                                                                                        condition.value
                                                                                                            .split(
                                                                                                                ","
                                                                                                            )
                                                                                                            .filter(
                                                                                                                Boolean
                                                                                                            );
                                                                                                    const newValues =
                                                                                                        selected
                                                                                                            ? values.filter(
                                                                                                                  (
                                                                                                                      v
                                                                                                                  ) =>
                                                                                                                      v !==
                                                                                                                      asn.code
                                                                                                              )
                                                                                                            : [
                                                                                                                  ...values,
                                                                                                                  asn.code
                                                                                                              ];
                                                                                                    updateCondition(
                                                                                                        groupIndex,
                                                                                                        conditionIndex,
                                                                                                        {
                                                                                                            value: newValues.join(
                                                                                                                ","
                                                                                                            )
                                                                                                        }
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <Check
                                                                                                    className={`mr-2 h-4 w-4 ${
                                                                                                        selected
                                                                                                            ? "opacity-100"
                                                                                                            : "opacity-0"
                                                                                                    }`}
                                                                                                />
                                                                                                {
                                                                                                    asn.name
                                                                                                }{" "}
                                                                                                (
                                                                                                {
                                                                                                    asn.code
                                                                                                }

                                                                                                )
                                                                                            </CommandItem>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        ) : (
                                                            <Popover>
                                                                <PopoverTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        className="w-full justify-between"
                                                                    >
                                                                        {condition.value
                                                                            ? (() => {
                                                                                  const found =
                                                                                      MAJOR_ASNS.find(
                                                                                          (
                                                                                              asn
                                                                                          ) =>
                                                                                              asn.code ===
                                                                                              condition.value
                                                                                      );
                                                                                  return found
                                                                                      ? `${found.name} (${condition.value})`
                                                                                      : condition.value;
                                                                              })()
                                                                            : "Select ASN"}
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0">
                                                                    <Command>
                                                                        <CommandInput placeholder="Search ASNs or enter custom..." />
                                                                        <CommandList>
                                                                            <CommandEmpty>
                                                                                No
                                                                                ASN
                                                                                found.
                                                                                Use
                                                                                the
                                                                                custom
                                                                                input
                                                                                below.
                                                                            </CommandEmpty>
                                                                            <CommandGroup>
                                                                                {MAJOR_ASNS.map(
                                                                                    (
                                                                                        asn
                                                                                    ) => (
                                                                                        <CommandItem
                                                                                            key={
                                                                                                asn.code
                                                                                            }
                                                                                            value={
                                                                                                asn.name +
                                                                                                " " +
                                                                                                asn.code
                                                                                            }
                                                                                            onSelect={() => {
                                                                                                updateCondition(
                                                                                                    groupIndex,
                                                                                                    conditionIndex,
                                                                                                    {
                                                                                                        value: asn.code
                                                                                                    }
                                                                                                );
                                                                                            }}
                                                                                        >
                                                                                            <Check
                                                                                                className={`mr-2 h-4 w-4 ${
                                                                                                    condition.value ===
                                                                                                    asn.code
                                                                                                        ? "opacity-100"
                                                                                                        : "opacity-0"
                                                                                                }`}
                                                                                            />
                                                                                            {
                                                                                                asn.name
                                                                                            }{" "}
                                                                                            (
                                                                                            {
                                                                                                asn.code
                                                                                            }

                                                                                            )
                                                                                        </CommandItem>
                                                                                    )
                                                                                )}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                    <div className="border-t p-2">
                                                                        <Input
                                                                            placeholder="Enter custom ASN (e.g., AS15169)"
                                                                            defaultValue={
                                                                                !MAJOR_ASNS.find(
                                                                                    (
                                                                                        asn
                                                                                    ) =>
                                                                                        asn.code ===
                                                                                        condition.value
                                                                                )
                                                                                    ? condition.value
                                                                                    : ""
                                                                            }
                                                                            onKeyDown={(
                                                                                e
                                                                            ) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    "Enter"
                                                                                ) {
                                                                                    const value =
                                                                                        e.currentTarget.value
                                                                                            .toUpperCase()
                                                                                            .replace(
                                                                                                /^AS/,
                                                                                                ""
                                                                                            );
                                                                                    if (
                                                                                        /^\d+$/.test(
                                                                                            value
                                                                                        )
                                                                                    ) {
                                                                                        updateCondition(
                                                                                            groupIndex,
                                                                                            conditionIndex,
                                                                                            {
                                                                                                value:
                                                                                                    "AS" +
                                                                                                    value
                                                                                            }
                                                                                        );
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="text-sm"
                                                                        />
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )
                                                    ) : (
                                                        <Input
                                                            value={
                                                                condition.value
                                                            }
                                                            onChange={(e) =>
                                                                updateCondition(
                                                                    groupIndex,
                                                                    conditionIndex,
                                                                    {
                                                                        value: e
                                                                            .target
                                                                            .value
                                                                    }
                                                                )
                                                            }
                                                            placeholder={
                                                                condition.operator ===
                                                                    "IN" ||
                                                                condition.operator ===
                                                                    "NOT_IN"
                                                                    ? "Enter comma-separated values (e.g., value1,value2,value3)"
                                                                    : "e.g., 192.168.1.1, /api/*"
                                                            }
                                                        />
                                                    )}
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        removeCondition(
                                                            groupIndex,
                                                            conditionIndex
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    )}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addCondition(groupIndex)}
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add Condition ({group.operator})
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsCreateDialogOpen(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={
                                editingPolicy ? updatePolicy : createPolicy
                            }
                            disabled={!newPolicy.name}
                        >
                            {editingPolicy ? "Update Policy" : "Create Policy"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isResourceDialogOpen}
                onOpenChange={setIsResourceDialogOpen}
            >
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Manage Resources for {selectedPolicy?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Select which resources this policy should apply to
                        </DialogDescription>
                    </DialogHeader>

                    {loadingResources ? (
                        <div className="py-8 text-center text-muted-foreground">
                            Loading resources...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAllResources}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearAllResources}
                                >
                                    Clear All
                                </Button>
                                <div className="ml-auto text-sm text-muted-foreground">
                                    {assignedResourceIds.length} of{" "}
                                    {allResources.length} selected
                                </div>
                            </div>

                            <div className="border rounded-md divide-y">
                                {allResources.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">
                                        No resources available
                                    </div>
                                ) : (
                                    allResources.map((resource) => (
                                        <div
                                            key={resource.resourceId}
                                            className="flex items-center gap-3 p-3 hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                checked={assignedResourceIds.includes(
                                                    resource.resourceId
                                                )}
                                                onCheckedChange={() =>
                                                    toggleResourceAssignment(
                                                        resource.resourceId
                                                    )
                                                }
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">
                                                    {resource.name}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {resource.niceId}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    window.open(
                                                        `/${params.orgId}/settings/resources/proxy/${resource.niceId}/general`,
                                                        "_blank"
                                                    )
                                                }
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsResourceDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={saveResourceAssignments}
                            disabled={loadingResources}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
