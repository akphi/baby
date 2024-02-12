import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type DiaperChangeEvent,
  type BottleFeedEvent,
  type PumpingEvent,
  type NursingEvent,
  Stage,
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
  NursingIcon,
  PoopIcon,
} from "../../shared/Icons";
import { mlToOz } from "../../shared/UnitUtils";
import { Divider } from "@mui/material";
import { isDuringDaytime } from "../../data/BabyCareUtils";

export const BabyCareStatistics = (props: {
  events: SerializeFrom<BabyCareEvent>[];
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { events, profile } = props;
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
      groupBy(events, (event) =>
        event.TYPE === BabyCareEventType.DIAPER_CHANGE
          ? (event as SerializeFrom<DiaperChangeEvent>).poop
            ? BabyCareEventType.__POOP
            : BabyCareEventType.__PEE
          : event.TYPE
      )
    )
  );
  const bottleEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.BOTTLE_FEED
  )?.[1] ?? []) as SerializeFrom<BottleFeedEvent>[];
  const totalBottleFeedVolume = bottleEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );
  const bottleStatsBadge = (
    <div className="flex items-center rounded bg-slate-300 text-slate-700 pl-1 pr-1.5 py-0.5 text-1.5xs ml-1.5 mono font-medium">
      <BottleIcon className="text-[15px] leading-[15px] w-[23px]" />
      <div className="ml-0.5">{totalBottleFeedVolume}ml</div>
      <Divider className="h-full bg-slate-400 mx-1" orientation="vertical" />
      <div className="ml-0.5">
        {Math.round(mlToOz(totalBottleFeedVolume))}oz
      </div>
      <Divider className="h-full bg-slate-400 mx-1" orientation="vertical" />
      <div className="">{bottleEvents.length}</div>
    </div>
  );

  const pumpingEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.PUMPING
  )?.[1] ?? []) as SerializeFrom<PumpingEvent>[];
  const totalPumpingVolume = pumpingEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );
  const pumpingStatsBadge = (
    <div className="flex items-center rounded bg-slate-300 text-slate-700 pl-1 pr-1.5 py-0.5 text-1.5xs ml-1.5 mono font-medium">
      <BreastPumpIcon className="text-[15px] leading-[15px] w-[23px]" />
      <div className="ml-0.5">{totalPumpingVolume}ml</div>
      <Divider className="h-full bg-slate-400 mx-1" orientation="vertical" />
      <div className="ml-0.5">
        {Math.round(mlToOz(totalPumpingVolume))}
        oz
      </div>
      <Divider className="h-full bg-slate-400 mx-1" orientation="vertical" />
      <div className="">{pumpingEvents.length}</div>
    </div>
  );

  const nursingEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.NURSING
  )?.[1] ?? []) as SerializeFrom<NursingEvent>[];
  const totalNursingDuration =
    nursingEvents.reduce(
      (acc, data) => acc + data.leftDuration + data.rightDuration,
      0
    ) /
    (1000 * 60 * 60);
  const nursingStatsBadge = (
    <div className="flex items-center rounded bg-slate-300 text-slate-700 pl-1 pr-1.5 py-0.5 text-1.5xs ml-1.5 mono font-medium">
      <NursingIcon className="text-[15px] leading-[15px] w-[23px]" />
      <div className="ml-0.5">
        {Math.round(totalNursingDuration * 10) / 10}h
      </div>
      <Divider className="h-full bg-slate-400 mx-1" orientation="vertical" />
      <div className="">{nursingEvents.length}</div>
    </div>
  );

  const poopEventCount =
    indexedData.find(([type]) => type === BabyCareEventType.__POOP)?.[1]
      .length ?? 0;
  const poopStatsBadge = (
    <div className="flex items-center rounded bg-slate-300 text-slate-700 pl-1 pr-1.5 py-0.5 text-1.5xs ml-1.5 mono font-medium">
      <PoopIcon className="text-[15px] leading-[15px] w-[23px]" />
      <div className="ml-0.5">{poopEventCount}</div>
    </div>
  );

  return (
    <div className="flex">
      {profile.stage === Stage.NEWBORN && nursingStatsBadge}
      {bottleStatsBadge}
      {pumpingStatsBadge}
      {poopStatsBadge}
    </div>
  );
};

export const BabyCareSummary = (props: {
  events: SerializeFrom<BabyCareEvent>[];
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { events, profile } = props;
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
    profile.settings.babyDaytimeStart,
    profile.settings.babyDaytimeEnd
  );
  const quotaText = `${profile.settings.defaultFeedingVolume}ml / ${
    (isDaytime
      ? profile.settings.defaultFeedingInterval
      : profile.settings.defaultNightFeedingInterval) /
    (60 * 60 * 1000)
  }hr`;

  // TODO?: customize this view by stage (newborn, infant, toddler, etc.)
  return (
    <div className="h-20 w-full fixed flex items-center justify-center bg-slate-700 z-10 shadow-md select-none">
      <div className="w-[calc(100%_-_12px)] flex flex-col items-center text-slate-300">
        <div
          className="flex overflow-x-auto w-full"
          style={{ justifyContent: "safe center" }}
        >
          <div className="select-none">{profile.nickname ?? profile.name}</div>
          <div className="rounded bg-slate-800 px-2 py-1 text-xs ml-1.5 mono font-medium whitespace-nowrap">
            {ageDisplayText}
          </div>
          <div className="rounded bg-slate-800 px-2 py-1 text-xs ml-1.5 mono font-medium whitespace-nowrap">
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
        <div
          className="flex mt-1.5 overflow-x-auto w-full"
          style={{ justifyContent: "safe center" }}
        >
          <BabyCareStatistics events={events} profile={profile} />
        </div>
      </div>
    </div>
  );
};
