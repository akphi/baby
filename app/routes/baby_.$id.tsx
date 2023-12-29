import { Divider } from "@mui/material";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareProfile,
  BottleFeedEvent,
  NursingEvent,
  PumpingEvent,
  DiaperChangeEvent,
  PlayEvent,
  BathEvent,
  SleepEvent,
} from "../data/baby-care";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { Link, useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { generateBabyCareEvent } from "./api.runCommand.$command";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";
import { BabyCareEventGrid } from "./baby/BabyCareEventGrid";
import { parseISO } from "date-fns";
import {
  extractOptionalNumber,
  extractOptionalString,
  extractRequiredBoolean,
  extractRequiredNumber,
  extractRequiredString,
} from "../shared/FormDataUtils";
import { BabyCareSummaryBar } from "./baby/BabyCareSummary";
import { ControllerIcon, ClockIcon, HomeIcon } from "../shared/Icons";
import { cn } from "../shared/StyleUtils";
import { useState } from "react";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const id = guaranteeNonNullable(params.id);
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profile = await entityManager.findOneOrFail(BabyCareProfile, {
    $or: [{ id }, { shortId: id }],
  });
  const events = await BabyCareDataRegistry.fetchEvents(
    profile,
    // NOTE: `date-fns` parseISO will return time in local timezone, which is what we pass in
    // if we use `new Date()` instead, it will be in UTC timezone and therefore, throw off the result
    date ? parseISO(date) : new Date()
  );

  return json({ profile, events });
};

enum Activity {
  DASHBOARD = "Dashboard",
  EVENT_LOG = "Event Log",
}

export default function BabyCare() {
  const { profile, events } = useLoaderData<typeof loader>();
  const [currentActivity, setCurrentActivity] = useState<Activity>(
    Activity.DASHBOARD
  );

  return (
    <div className="h-full w-full bg-slate-50">
      <BabyCareSummaryBar />
      <main className="w-full overflow-auto h-[calc(100%_-_64px)]">
        {/* empty toolbar to offset the content the height of the floating toolbar */}
        <div className="h-16 w-full" />
        <div className="h-[calc(100%_-_64px)] w-full">
          {currentActivity === Activity.DASHBOARD && (
            <BabyCareDashboard profile={profile} />
          )}
          {currentActivity === Activity.EVENT_LOG && (
            <BabyCareEventGrid profile={profile} events={events} />
          )}
        </div>
      </main>
      <footer className="h-16 w-full flex justify-center items-end">
        <div className="flex h-14 items-center rounded-t-lg shadow-lg bg-white px-4">
          <Link to={`/baby`} className="h-full">
            <button
              className={cn(
                "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white hover:border-blue-200"
              )}
            >
              <HomeIcon className="text-4xl" />
            </button>
          </Link>
          <Divider
            orientation="vertical"
            className="bg-slate-50 h-8 opacity-50 mx-2"
          />
          <button
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white hover:border-blue-200",
              {
                "text-blue-500": currentActivity === Activity.DASHBOARD,
                "border-blue-500": currentActivity === Activity.DASHBOARD,
                "hover:text-blue-500": currentActivity === Activity.DASHBOARD,
                "hover:border-blue-500": currentActivity === Activity.DASHBOARD,
              }
            )}
            onClick={() => setCurrentActivity(Activity.DASHBOARD)}
          >
            <ControllerIcon className="text-7xl" />
          </button>
          <Divider
            orientation="vertical"
            className="bg-slate h-8 opacity-50 mx-2"
          />
          <button
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white hover:border-blue-200",
              {
                "text-blue-500": currentActivity === Activity.EVENT_LOG,
                "border-blue-500": currentActivity === Activity.EVENT_LOG,
                "hover:text-blue-500": currentActivity === Activity.EVENT_LOG,
                "hover:border-blue-500": currentActivity === Activity.EVENT_LOG,
              }
            )}
            onClick={() => setCurrentActivity(Activity.EVENT_LOG)}
          >
            <ClockIcon className="text-4xl" />
          </button>
        </div>
      </footer>
    </div>
  );
}

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
    case BabyCareAction.CREATE_PLAY_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");

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

      const event = generateBabyCareEvent(action, profile);
      if (!event) {
        return json(
          { error: `Unsupported event generation for command '${action}'` },
          HttpStatus.NOT_IMPLEMENTED
        );
      }

      entityManager.persistAndFlush(event);

      event.TYPE = event.eventType;
      event.HASH = event.hashCode;

      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(BottleFeedEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.volume = extractRequiredNumber(formData, "volume");
      event.formulaMilkVolume = extractOptionalNumber(
        formData,
        "formulaMilkVolume"
      );

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_PUMPING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(PumpingEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.volume = extractRequiredNumber(formData, "volume");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_NURSING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(NursingEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.leftDuration = extractRequiredNumber(formData, "leftDuration");
      event.rightDuration = extractRequiredNumber(formData, "rightDuration");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(DiaperChangeEvent, {
        id,
      });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.poop = extractRequiredBoolean(formData, "poop");
      event.pee = extractRequiredBoolean(formData, "pee");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_SLEEP_EVENT:
    case BabyCareAction.UPDATE_BATH_EVENT:
    case BabyCareAction.UPDATE_PLAY_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const clazz =
        action === BabyCareAction.UPDATE_PLAY_EVENT
          ? PlayEvent
          : action === BabyCareAction.UPDATE_BATH_EVENT
          ? BathEvent
          : action === BabyCareAction.UPDATE_SLEEP_EVENT
          ? SleepEvent
          : undefined;
      const event = await entityManager.findOneOrFail(
        guaranteeNonNullable(clazz),
        { id }
      );

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.REMOVE_BOTTLE_FEED_EVENT:
    case BabyCareAction.REMOVE_PUMPING_EVENT:
    case BabyCareAction.REMOVE_NURSING_EVENT:
    case BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.REMOVE_PLAY_EVENT:
    case BabyCareAction.REMOVE_BATH_EVENT:
    case BabyCareAction.REMOVE_SLEEP_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const clazz =
        action === BabyCareAction.REMOVE_BOTTLE_FEED_EVENT
          ? BottleFeedEvent
          : action === BabyCareAction.REMOVE_PUMPING_EVENT
          ? PumpingEvent
          : action === BabyCareAction.REMOVE_NURSING_EVENT
          ? NursingEvent
          : action === BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT
          ? DiaperChangeEvent
          : action === BabyCareAction.REMOVE_PLAY_EVENT
          ? PlayEvent
          : action === BabyCareAction.REMOVE_BATH_EVENT
          ? BathEvent
          : action === BabyCareAction.REMOVE_SLEEP_EVENT
          ? SleepEvent
          : undefined;
      const event = await entityManager.findOneOrFail(
        guaranteeNonNullable(clazz),
        {
          id,
        }
      );
      await entityManager.removeAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    default:
      return null;
  }
}
