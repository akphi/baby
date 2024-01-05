import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type DiaperChangeEvent,
  type BottleFeedEvent,
  type PumpingEvent,
} from "../../data/BabyCare";
import { groupBy, merge } from "lodash-es";
import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
} from "date-fns";
import {
  BottleIcon,
  BreastPumpIcon,
  DarkModeIcon,
  LightModeIcon,
  PoopIcon,
} from "../../shared/Icons";
import { mlToOz } from "../../shared/UnitUtils";
import { Divider } from "@mui/material";
import { isDuringDaytime } from "../../data/BabyCareUtils";

export const BabyCareSummary = (props: {
  currentEvents: SerializeFrom<BabyCareEvent>[];
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { currentEvents, profile } = props;
  const indexedData = Object.entries(
    merge(
      {
        [BabyCareEventType.BOTTLE_FEED]: [],
        [BabyCareEventType.PUMPING]: [],
        [BabyCareEventType.__POOP]: [],
        [BabyCareEventType.__PEE]: [],
        [BabyCareEventType.SLEEP]: [],
        [BabyCareEventType.BATH]: [],
        [BabyCareEventType.PLAY]: [],
        [BabyCareEventType.NURSING]: [],
      },
      groupBy(currentEvents, (event) =>
        event.TYPE === BabyCareEventType.DIAPER_CHANGE
          ? (event as SerializeFrom<DiaperChangeEvent>).poop
            ? BabyCareEventType.__POOP
            : BabyCareEventType.__PEE
          : event.TYPE
      )
    )
  );
  // stats
  const poopEventCount =
    indexedData.find(([type]) => type === BabyCareEventType.__POOP)?.[1]
      .length ?? 0;
  const bottleEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.BOTTLE_FEED
  )?.[1] ?? []) as SerializeFrom<BottleFeedEvent>[];
  const totalBottleFeedVolume = bottleEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );
  const pumpingEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.PUMPING
  )?.[1] ?? []) as SerializeFrom<PumpingEvent>[];
  const totalPumpingVolume = pumpingEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );
  // age
  const ageInDays = differenceInCalendarDays(new Date(), new Date(profile.dob));
  const ageInWeeks = differenceInCalendarWeeks(
    new Date(),
    new Date(profile.dob)
  );
  const ageInMonths = differenceInCalendarMonths(
    new Date(),
    new Date(profile.dob)
  );
  const ageInYears = differenceInCalendarYears(
    new Date(),
    new Date(profile.dob)
  );
  const ageDisplayText =
    ageInYears >= 2
      ? `${ageInYears} years`
      : ageInMonths >= 12
      ? `${ageInMonths} months`
      : ageInWeeks > 1
      ? `${ageInWeeks} weeks`
      : `${ageInDays} days`;
  // quota
  const isDaytime = isDuringDaytime(
    new Date(),
    profile.babyDaytimeStart,
    profile.babyDaytimeEnd
  );
  const quotaText = `${profile.defaultFeedingVolume}ml / ${
    (isDaytime
      ? profile.defaultFeedingInterval
      : profile.defaultNightFeedingInterval) /
    (60 * 60 * 1000)
  }hr`;

  // TODO?: customize this view by stage (newborn, infant, toddler, etc.)
  return (
    <div className="h-20 w-full fixed flex items-center justify-center bg-slate-700 z-10 shadow-md select-none">
      <div className="flex flex-col items-center text-slate-300">
        <div className="flex items-center">
          <div className="select-none">{profile.nickname ?? profile.name}</div>
          <div className="rounded bg-slate-800 px-2 py-1 text-xs ml-1.5 mono font-medium">
            {ageDisplayText}
          </div>
          <div className="rounded bg-slate-800 px-2 py-1 text-xs ml-1.5 mono font-medium">
            {quotaText}
          </div>
          <div className="rounded h-6 w-6 flex items-center justify-center bg-slate-800 ml-1.5">
            {isDaytime ? (
              <LightModeIcon className="text-base" />
            ) : (
              <DarkModeIcon className="text-base text-slate-500" />
            )}
          </div>
        </div>
        <div className="flex mt-1.5">
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <BottleIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{totalBottleFeedVolume}ml</div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="ml-0.5">
              {Math.round(mlToOz(totalBottleFeedVolume))}oz
            </div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="">{bottleEvents.length}</div>
          </div>
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <BreastPumpIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{totalPumpingVolume}ml</div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="ml-0.5">
              {Math.round(mlToOz(totalPumpingVolume))}
              oz
            </div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="">{pumpingEvents.length}</div>
          </div>
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <PoopIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{poopEventCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
