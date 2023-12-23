import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BottleFeedEvent,
  DEFAULT_FEEDING_VOLUME,
  BabyCareProfile,
  type BabyCareEvent,
  NursingEvent,
  PumpingEvent,
  DEFAULT_PUMPING_DURATION,
  DEFAULT_NURSING_DURATION_FOR_EACH_SIDE,
  DiaperChangeEvent,
  SleepEvent,
  PlayEvent,
  BathEvent,
} from "../data/baby-care";
import { HttpStatus } from "../shared/NetworkUtils";

export enum Command {
  BABY_CARE__BOTTLE_FEED = "baby-care.feed.bottle",
  BABY_CARE__NURSING = "baby-care.feed.nursing",
  BABY_CARE__PUMPING = "baby-care.feed.pumping",
  BABY_CARE__DIAPER_CHANGE__POOP = "baby-care.diaper-change.poop",
  BABY_CARE__DIAPER_CHANGE__PEE = "baby-care.diaper-change.pee",
  BABY_CARE__SLEEP = "baby-care.sleep",
  BABY_CARE__PLAY = "baby-care.play",
  BABY_CARE__BATH = "baby-care.bath",
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const payload = await request.json();
  const command = params.command;

  switch (command) {
    case Command.BABY_CARE__BOTTLE_FEED:
    case Command.BABY_CARE__NURSING:
    case Command.BABY_CARE__PUMPING:
    case Command.BABY_CARE__DIAPER_CHANGE__POOP:
    case Command.BABY_CARE__DIAPER_CHANGE__PEE:
    case Command.BABY_CARE__SLEEP:
    case Command.BABY_CARE__PLAY:
    case Command.BABY_CARE__BATH: {
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
          $or: [{ id }, { shortId: id }],
        });
      } catch {
        return json(
          { error: `Baby care profile (id/shortId = ${id}) not found` },
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
    case Command.BABY_CARE__BOTTLE_FEED: {
      return new BottleFeedEvent(
        new Date(),
        profile,
        profile.defaultFeedingVolume ?? DEFAULT_FEEDING_VOLUME
      );
    }
    case Command.BABY_CARE__NURSING: {
      const event = new NursingEvent(new Date(), profile);
      event.rightDuration = event.leftDuration =
        DEFAULT_NURSING_DURATION_FOR_EACH_SIDE;
      return event;
    }
    case Command.BABY_CARE__PUMPING: {
      const event = new PumpingEvent(new Date(), profile);
      event.duration = profile.defaultPumpingDuration ?? DEFAULT_PUMPING_DURATION;
      return event;
    }
    case Command.BABY_CARE__DIAPER_CHANGE__POOP: {
      const event = new DiaperChangeEvent(new Date(), profile);
      event.poop = true;
      event.pee = true;
      return event;
    }
    case Command.BABY_CARE__DIAPER_CHANGE__PEE: {
      const event = new DiaperChangeEvent(new Date(), profile);
      event.pee = true;
      return event;
    }
    case Command.BABY_CARE__SLEEP: {
      return new SleepEvent(new Date(), profile);
    }
    case Command.BABY_CARE__PLAY: {
      return new PlayEvent(new Date(), profile);
    }
    case Command.BABY_CARE__BATH: {
      return new BathEvent(new Date(), profile);
    }
    default:
      return undefined;
  }
}
