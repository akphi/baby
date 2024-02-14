import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { BabyCareDataRegistry } from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { parseISO } from "date-fns";
import { DEFAULT_SEARCH_PAGE_SIZE } from "../data/constants";
import { parseNumber, returnUndefOnError } from "../shared/CommonUtils";
import { BabyCareEventSearch } from "./baby/BabyCareEventSearch";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Search: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("type");
  const groupBy = searchParams.get("groupBy");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const result = eventType
    ? await BabyCareDataRegistry.lookupEvents(profile, eventType, 0, 0, {
        startDate: startDate ? parseISO(startDate) : undefined,
        endDate: endDate ? parseISO(endDate) : undefined,
      })
    : { events: [], totalCount: 0 };
  return json({ profile, result });
};

export default function BabyCareTrend() {
  const { profile, result } = useLoaderData<typeof loader>();
  return (
    <BabyCareEventSearch
      profile={profile}
      events={result.events}
      totalCount={result.totalCount}
    />
  );
}
