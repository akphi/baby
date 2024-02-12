import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareEventManager,
} from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { BabyCareEventGrid } from "./baby/BabyCareEventGrid";
import { parseISO } from "date-fns";
import { extractRequiredString } from "../shared/FormDataUtils";
import { DEFAULT_SEARCH_PAGE_SIZE } from "../data/constants";
import { parseNumber, returnUndefOnError } from "../shared/CommonUtils";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Logs: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );
  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("type");
  const page =
    returnUndefOnError(() => parseNumber(searchParams.get("page") ?? "")) ?? 0;
  const pageSize =
    returnUndefOnError(() => parseNumber(searchParams.get("pageSize") ?? "")) ??
    DEFAULT_SEARCH_PAGE_SIZE; // TODO: support page-size
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
        }
      )
    : { events: [], totalCount: 0 };
  console.log(result);
  return json({ profile, result });
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.CREATE_BOTTLE_FEED_EVENT:
    case BabyCareAction.CREATE_NURSING_EVENT:
    case BabyCareAction.CREATE_PUMPING_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT:
    case BabyCareAction.CREATE_SLEEP_EVENT:
    case BabyCareAction.CREATE_BATH_EVENT:
    case BabyCareAction.CREATE_PLAY_EVENT:
    case BabyCareAction.CREATE_MEASUREMENT_EVENT:
    case BabyCareAction.CREATE_MEDICINE_EVENT:
    case BabyCareAction.CREATE_NOTE_EVENT: {
      const profileIdOrHandle = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.quickCreateEvent(
        action,
        profileIdOrHandle
      );
      return json({ event }, HttpStatus.OK);
    }
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
    case BabyCareAction.UPDATE_PROFILE: {
      const { profile } = await BabyCareDataRegistry.createOrUpdateProfile(
        formData
      );
      return json({ profile }, HttpStatus.OK);
    }
    case BabyCareAction.REQUEST_ASSISTANT: {
      const profileIdOrHandle = extractRequiredString(formData, "id");
      await BabyCareEventManager.notificationService.requestAssistant(
        profileIdOrHandle
      );
    }
    default:
      return null;
  }
}

export default function BabyCareLogs() {
  const { profile, result } = useLoaderData<typeof loader>();
  return <BabyCareEventGrid profile={profile} events={result.events} />;
}
