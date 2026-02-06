import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { AxiosResponse } from "axios";
import PoliciesClient from "./PoliciesClient";

type PoliciesPageProps = {
    params: Promise<{ orgId: string }>;
};

interface Policy {
    policyId: number;
    name: string;
    description?: string;
    enabled: boolean;
    action: "ACCEPT" | "DROP" | "PASS";
    priority: number;
    createdAt: string;
    updatedAt: string;
}

interface ListPoliciesResponse {
    policies: Policy[];
}

export const dynamic = "force-dynamic";

export default async function PoliciesPage(props: PoliciesPageProps) {
    const params = await props.params;

    let policies: Policy[] = [];

    const res = await internal
        .get<
            AxiosResponse<ListPoliciesResponse>
        >(`/${params.orgId}/policies`, await authCookieHeader())
        .catch((e) => {});

    if (res && res.status === 200) {
        policies = res.data.data.policies;
    }

    return <PoliciesClient initialPolicies={policies} />;
}
