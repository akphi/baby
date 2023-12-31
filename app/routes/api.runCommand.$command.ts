import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { BabyCareDataRegistry, BabyCareAction } from "../data/BabyCare";
import { HttpStatus } from "../shared/NetworkUtils";
import { guaranteeNonEmptyString } from "../shared/AssertionUtils";

export async function action({ request, params }: ActionFunctionArgs) {
  const payload = await request.json();
  const command = params.command;

  switch (command) {
    case BabyCareAction.CREATE_BOTTLE_FEED_EVENT:
    case BabyCareAction.CREATE_NURSING_EVENT:
    case BabyCareAction.CREATE_PUMPING_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT:
    case BabyCareAction.CREATE_SLEEP_EVENT:
    case BabyCareAction.CREATE_BATH_EVENT:
    case BabyCareAction.CREATE_PLAY_EVENT: {
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
