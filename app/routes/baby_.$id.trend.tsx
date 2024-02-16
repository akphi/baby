import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareEventGroupByType,
} from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { parseISO } from "date-fns";
import { BabyCareEventTrend } from "./baby/BabyCareEventTrend.client";
import { ClientOnly } from "remix-utils/client-only";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Trend: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("type");
  const groupBy = searchParams.get("groupBy") ?? BabyCareEventGroupByType.DATE;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const stats = eventType
    ? await BabyCareDataRegistry.getStats(profile, eventType, groupBy, {
        startDate: startDate ? parseISO(startDate) : undefined,
        endDate: endDate ? parseISO(endDate) : undefined,
      })
    : { records: [] };
  return json({ profile, stats });
};

export default function BabyCareTrend() {
  const { profile, stats } = useLoaderData<typeof loader>();
  return (
    // NOTE: This is a client-only component since it requires access to window object
    // See https://github.com/remix-run/remix/discussions/6424
    <ClientOnly fallback={null}>
      {() => <BabyCareEventTrend profile={profile} stats={stats} />}
    </ClientOnly>
  );
}
