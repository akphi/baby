import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { BabyCareAction, BabyCareDataRegistry } from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { parseISO } from "date-fns";
import { DEFAULT_SEARCH_PAGE_SIZE } from "../data/constants";
import { parseNumber, returnUndefOnError } from "../shared/CommonUtils";
import { BabyCareEventSearch } from "./baby/BabyCareEventSearch";
import { extractRequiredString } from "../shared/FormDataUtils";
import { HttpStatus } from "../shared/NetworkUtils";

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
  const page =
    returnUndefOnError(() => parseNumber(searchParams.get("page") ?? "NaN")) ??
    1;
  const searchText = searchParams.has("text")
    ? decodeURIComponent(searchParams.get("text") ?? "")
    : undefined;
  const pageSize = DEFAULT_SEARCH_PAGE_SIZE; // TODO: support page-size
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const result = eventType
    ? await BabyCareDataRegistry.lookupEvents(
        profile,
        eventType,
        pageSize,
        page,
        {
          startDate: startDate ? parseISO(startDate) : undefined,
          endDate: endDate ? parseISO(endDate) : undefined,
          searchText,
        }
      )
    : { events: [], totalCount: 0 };
  return json({ profile, result });
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT:
    case BabyCareAction.UPDATE_PUMPING_EVENT:
    case BabyCareAction.UPDATE_NURSING_EVENT:
    case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.UPDATE_SLEEP_EVENT:
    case BabyCareAction.UPDATE_BATH_EVENT:
    case BabyCareAction.UPDATE_PLAY_EVENT:
    case BabyCareAction.UPDATE_MEASUREMENT_EVENT:
    case BabyCareAction.UPDATE_MEDICINE_EVENT:
    case BabyCareAction.UPDATE_NOTE_EVENT: {
      const eventId = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.updateEvent(formData, eventId);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.REMOVE_BOTTLE_FEED_EVENT:
    case BabyCareAction.REMOVE_PUMPING_EVENT:
    case BabyCareAction.REMOVE_NURSING_EVENT:
    case BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.REMOVE_PLAY_EVENT:
    case BabyCareAction.REMOVE_BATH_EVENT:
    case BabyCareAction.REMOVE_SLEEP_EVENT:
    case BabyCareAction.REMOVE_MEASUREMENT_EVENT:
    case BabyCareAction.REMOVE_MEDICINE_EVENT:
    case BabyCareAction.REMOVE_NOTE_EVENT: {
      const eventId = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.removeEvent(action, eventId);
      return json({ event }, HttpStatus.OK);
    }
    default:
      return null;
  }
}

export default function BabyCareSearch() {
  const { profile, result } = useLoaderData<typeof loader>();
  return (
    <BabyCareEventSearch
      profile={profile}
      events={result.events}
      totalCount={result.totalCount}
    />
  );
}
