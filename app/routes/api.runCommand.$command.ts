import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BottleFeedEvent,
  BabyCareProfile,
  type BabyCareEvent,
  NursingEvent,
  PumpingEvent,
  DiaperChangeEvent,
  SleepEvent,
  PlayEvent,
  BathEvent,
  BabyCareAction,
} from "../data/baby-care";
import { HttpStatus } from "../shared/NetworkUtils";
import { DEFAULT_NURSING_DURATION_FOR_EACH_SIDE } from "../data/constants";

export const action = async ({ request, params }: ActionFunctionArgs) => {
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
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = payload.profileId?.trim();
      if (!id) {
        return json(
          { error: "'profileId' is missing or empty" },
          HttpStatus.BAD_REQUEST
        );
      }

      let profile: BabyCareProfile;
      try {
        profile = await entityManager.findOneOrFail(BabyCareProfile, {
          $or: [{ id }, { handle: id }],
        });
      } catch {
        return json(
          { error: `Baby care profile (id/handle = ${id}) not found` },
          HttpStatus.NOT_FOUND
        );
      }

      const event = generateBabyCareEvent(command, profile);
      if (!event) {
        return json(
          { error: `Unsupported event generation for command '${command}'` },
          HttpStatus.NOT_IMPLEMENTED
        );
      }

      entityManager.persistAndFlush(event);
      return json({ eventId: event.id }, HttpStatus.OK);
    }
    default:
      return null;
  }
};

export function generateBabyCareEvent(
  command: string,
  profile: BabyCareProfile
): BabyCareEvent | undefined {
  switch (command) {
    case BabyCareAction.CREATE_BOTTLE_FEED_EVENT: {
      return new BottleFeedEvent(
        new Date(),
        profile,
        profile.defaultFeedingVolume
      );
    }
    case BabyCareAction.CREATE_NURSING_EVENT: {
      const event = new NursingEvent(new Date(), profile);
      event.rightDuration = event.leftDuration =
        DEFAULT_NURSING_DURATION_FOR_EACH_SIDE;
      return event;
    }
    case BabyCareAction.CREATE_PUMPING_EVENT: {
      const event = new PumpingEvent(new Date(), profile);
      event.duration = profile.defaultPumpingDuration;
      event.volume = profile.defaultFeedingVolume;
      return event;
    }
    case BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT: {
      const event = new DiaperChangeEvent(new Date(), profile);
      event.poop = true;
      event.pee = true;
      return event;
    }
    case BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT: {
      const event = new DiaperChangeEvent(new Date(), profile);
      event.pee = true;
      return event;
    }
    case BabyCareAction.CREATE_SLEEP_EVENT: {
      return new SleepEvent(new Date(), profile);
    }
    case BabyCareAction.CREATE_PLAY_EVENT: {
      return new PlayEvent(new Date(), profile);
    }
    case BabyCareAction.CREATE_BATH_EVENT: {
      return new BathEvent(new Date(), profile);
    }
    default:
      return undefined;
  }
}
