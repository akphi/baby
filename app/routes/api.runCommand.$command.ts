import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareAction,
  BabyCareEventManager,
} from "../data/BabyCare";
import { HttpStatus } from "../shared/NetworkUtils";
import { guaranteeNonEmptyString } from "../shared/AssertionUtils";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const command = params.command;
  const { searchParams } = new URL(request.url);

  switch (command) {
    case BabyCareAction.FETCH_TOP_PRESCRIPTIONS: {
      const profileId = guaranteeNonEmptyString(
        searchParams.get("profileId"),
        "'profileId' is missing or empty"
      );
      const searchText = searchParams.get("searchText")?.trim();
      const prescriptions = await BabyCareDataRegistry.fetchTopPrescriptions(
        profileId,
        searchText
      );
      return json({ prescriptions }, HttpStatus.OK);
    }
    default:
      return null;
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const payload = await request.json();
  const command = params.command;

  switch (command) {
    case BabyCareAction.REQUEST_ASSISTANT: {
      const idOrHandle = guaranteeNonEmptyString(
        payload.profileId?.trim(),
        "'profileId' is missing or empty"
      );
      await BabyCareEventManager.notificationService.requestAssistant(
        idOrHandle
      );
      return json({}, HttpStatus.OK);
    }
    case BabyCareAction.NOTIFY_MESSAGE: {
      const idOrHandle = payload.profileId?.trim();
      const debug = payload.debug ? Boolean(payload.debug) : undefined;
      const message = guaranteeNonEmptyString(
        payload.message,
        "'message' is missing or empty"
      ).trim();
      await BabyCareEventManager.notificationService.notifyMessage(message, {
        idOrHandle,
        debug,
      });
      return json({}, HttpStatus.OK);
    }
    case BabyCareAction.CREATE_DYNAMIC_EVENT:
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
    case BabyCareAction.CREATE_TRAVEL_EVENT: {
      const idOrHandle = guaranteeNonEmptyString(
        payload.profileId?.trim(),
        "'profileId' is missing or empty"
      );
      const event = await BabyCareDataRegistry.quickCreateEvent(
        command,
        idOrHandle
      );
      return json({ eventId: event.id }, HttpStatus.OK);
    }
    default:
      return null;
  }
}
