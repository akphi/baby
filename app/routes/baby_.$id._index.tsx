import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { BabyCareAction, BabyCareDataRegistry } from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { extractRequiredString } from "../shared/FormDataUtils";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [
    { title: `Dashboard: ${data.profile.nickname ?? data.profile.name}` },
  ];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );
  return json({ profile });
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
    case BabyCareAction.CREATE_NOTE_EVENT:
    case BabyCareAction.CREATE_MEMORY_EVENT:
    case BabyCareAction.CREATE_FOOD_FIRST_TRY_EVENT:
    case BabyCareAction.CREATE_TRAVEL_EVENT: {
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
    case BabyCareAction.UPDATE_NOTE_EVENT:
    case BabyCareAction.UPDATE_TRAVEL_EVENT: {
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
    case BabyCareAction.REMOVE_NOTE_EVENT:
    case BabyCareAction.REMOVE_TRAVEL_EVENT: {
      const eventId = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.removeEvent(action, eventId);
      return json({ event }, HttpStatus.OK);
    }
    default:
      return null;
  }
}

export default function BabyCare() {
  const { profile } = useLoaderData<typeof loader>();
  return <BabyCareDashboard profile={profile} />;
}
