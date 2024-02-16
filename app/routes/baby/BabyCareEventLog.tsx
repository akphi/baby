import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type DiaperChangeEvent,
  type NoteEvent,
  NotePurpose,
} from "../../data/BabyCare";
import { add, format, isEqual, parseISO, startOfDay, sub } from "date-fns";
import {
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChildToyIcon,
  MeasurementIcon,
  MedicineIcon,
  MemoryIcon,
  NoteIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  SleepIcon,
} from "../../shared/Icons";
import { useState } from "react";
import { groupBy, merge } from "lodash-es";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { cn } from "../../shared/StyleUtils";
import { useSearchParams } from "@remix-run/react";
import { BabyCareStatistics } from "./BabyCareSummary";
import { BabyCareEventGrid } from "./BabyCareEventGrid";
import { Divider } from "@mui/material";

const BabyCareEventGridSummary = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
  selectedDate: Date;
}) => {
  const { events, profile, selectedDate } = props;

  return (
    <div className="flex items-center w-full bg-slate-700 overflow-y-hidden overflow-x-auto select-none">
      <div className="h-10 flex items-center px-3">
        <div className="w-16 flex items-center justify-center rounded text-slate-300 bg-slate-800 px-2 py-1 text-xs mono font-medium uppercase">
          {format(selectedDate, "MMM dd")}
        </div>
        <BabyCareStatistics events={events} profile={profile} />
      </div>
    </div>
  );
};

export const BabyCareEventLog = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { profile, events } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined
  );
  const selectedDate = startOfDay(
    searchParams.has("date")
      ? parseISO(searchParams.get("date") as string)
      : new Date()
  );
  const setSelectedDate = (date: Date) => {
    if (!isEqual(date, startOfDay(new Date()))) {
      setSearchParams((params) => {
        params.set("date", format(date, "yyyy-MM-dd"));
        return params;
      });
    } else {
      setSearchParams((params) => {
        params.delete("date");
        return params;
      });
    }
  };

  return (
    <div className="w-full h-full">
      <div className="h-10 flex items-center w-full bg-slate-100 overflow-y-hidden overflow-x-auto">
        <div className="flex items-center pl-2">
          <button
            className="text-slate-500 hover:text-slate-600"
            onClick={() =>
              setSelectedDate(sub(startOfDay(selectedDate), { days: 1 }))
            }
          >
            <ChevronLeftIcon />
          </button>
          <MobileDatePicker
            slotProps={{
              textField: {
                InputProps: {
                  classes: {
                    input:
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
            }}
            value={selectedDate}
            onAccept={(value: Date | null) => {
              setSelectedDate(startOfDay(value ?? new Date()));
            }}
            format="MMM dd, EEE"
          />
          <button
            className="text-slate-500 hover:text-slate-600"
            onClick={() =>
              setSelectedDate(add(startOfDay(selectedDate), { days: 1 }))
            }
          >
            <ChevronRightIcon />
          </button>
          <button
            className={cn(
              "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500": isEqual(
                  selectedDate,
                  startOfDay(new Date())
                ),
              }
            )}
            onClick={() => setSelectedDate(startOfDay(new Date()))}
          >
            <div className="font-medium text-slate-600 text-2xs">TODAY</div>
          </button>
        </div>
        <Divider className="h-5 mx-2 " orientation="vertical" />
        <div className="w-full flex items-center">
          <button
            className={cn(
              "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  selectedEvent === undefined,
              }
            )}
            onClick={() => setSelectedEvent(undefined)}
          >
            <div className="font-medium text-slate-600 text-sm">ALL</div>
            <div className="rounded text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
              {events.length}
            </div>
          </button>
          {Object.entries(
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
                [BabyCareEventType.MEASUREMENT]: [],
                [BabyCareEventType.MEDICINE]: [],
                [BabyCareEventType.NOTE]: [],
                [BabyCareEventType.__MEMORY]: [],
              },
              groupBy(events, (event) =>
                event.TYPE === BabyCareEventType.DIAPER_CHANGE
                  ? (event as SerializeFrom<DiaperChangeEvent>).poop
                    ? BabyCareEventType.__POOP
                    : BabyCareEventType.__PEE
                  : event.TYPE === BabyCareEventType.NOTE
                  ? (event as SerializeFrom<NoteEvent>).purpose ===
                    NotePurpose.MEMORY
                    ? BabyCareEventType.__MEMORY
                    : BabyCareEventType.NOTE
                  : event.TYPE
              )
            )
          ).map(([type, items]) => (
            <button
              key={type}
              onClick={() => setSelectedEvent(type)}
              className={cn(
                "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
                {
                  "bg-blue-100 border-blue-500 hover:border-blue-500":
                    selectedEvent === type,
                }
              )}
            >
              <div className="h-full flex items-center justify-center">
                {type === BabyCareEventType.BOTTLE_FEED && (
                  <BottleIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.NURSING && (
                  <NursingIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.PUMPING && (
                  <BreastPumpIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.__PEE && (
                  <PeeIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.__POOP && (
                  <PoopIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.SLEEP && (
                  <SleepIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.PLAY && (
                  <ChildToyIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.BATH && (
                  <BathIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.MEASUREMENT && (
                  <MeasurementIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.MEDICINE && (
                  <MedicineIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.NOTE && (
                  <NoteIcon className="text-[20px] leading-[20px]" />
                )}
                {type === BabyCareEventType.__MEMORY && (
                  <MemoryIcon className="text-[20px] leading-[20px]" />
                )}
              </div>
              <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
                {items.length ?? 0}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-quartz h-[calc(100%_-_80px)]">
        <BabyCareEventGrid
          events={events.filter((event) => {
            switch (selectedEvent) {
              case undefined:
                return true;
              case BabyCareEventType.__POOP:
                return (
                  event.TYPE === BabyCareEventType.DIAPER_CHANGE &&
                  (event as SerializeFrom<DiaperChangeEvent>).poop
                );
              case BabyCareEventType.__PEE:
                return (
                  event.TYPE === BabyCareEventType.DIAPER_CHANGE &&
                  !(event as SerializeFrom<DiaperChangeEvent>).poop
                );
              case BabyCareEventType.__MEMORY:
                return (
                  event.TYPE === BabyCareEventType.NOTE &&
                  (event as SerializeFrom<NoteEvent>).purpose ===
                    NotePurpose.MEMORY
                );
              default:
                return event.TYPE === selectedEvent;
            }
          })}
          profile={profile}
        />
      </div>
      <BabyCareEventGridSummary
        profile={profile}
        events={events}
        selectedDate={selectedDate}
      />
    </div>
  );
};
