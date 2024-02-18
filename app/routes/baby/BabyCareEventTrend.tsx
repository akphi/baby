import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareProfile,
  type BabyCareEventStats,
  type BabyCareEventTimeSeriesStats,
  BabyCareEventTimeSeriesStatsRange,
} from "../../data/BabyCare";
import { format, isEqual, parseISO, startOfDay } from "date-fns";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { useSearchParams } from "@remix-run/react";
import {
  Divider,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { pruneNullValues } from "../../shared/CommonUtils";
import { cn } from "../../shared/StyleUtils";
import { ChildCareIcon } from "../../shared/Icons";
import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
} from "chart.js";
import { BabyCareTimeSeriesStatsDisplay } from "./BabyCareTimeSeriesStatsDisplay.client";
import { ClientOnly } from "remix-utils/client-only";

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip
);

const BabyCareEventStatsNoSupport = () => (
  <div className="h-full flex justify-center items-center font-medium text-slate-500 select-none text-sm">
    {`Can't display stats`}
  </div>
);

const BabyCareEventStatsDisplay = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  eventType: string;
  stats: SerializeFrom<BabyCareEventStats>;
}) => {
  const { profile, eventType, stats } = props;

  if (stats.records.length) {
    switch (eventType) {
      case BabyCareEventType.BOTTLE_FEED.toLowerCase():
      case BabyCareEventType.NURSING.toLowerCase():
      case BabyCareEventType.PUMPING.toLowerCase(): {
        return (
          // NOTE: This is a client-only component since it requires access to window object
          // See https://github.com/remix-run/remix/discussions/6424
          <ClientOnly fallback={<BabyCareEventStatsNoSupport />}>
            {() => (
              <BabyCareTimeSeriesStatsDisplay
                profile={profile}
                eventType={eventType}
                stats={stats as SerializeFrom<BabyCareEventTimeSeriesStats>}
              />
            )}
          </ClientOnly>
        );
      }
      default:
        break;
    }
  }

  return <BabyCareEventStatsNoSupport />;
};

export const BabyCareEventTrend = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  stats: SerializeFrom<BabyCareEventStats>;
}) => {
  const { profile, stats } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const eventType = searchParams.get("type")?.toLowerCase();
  const birthDate = new Date(profile.dob);
  const startDate = searchParams.has("startDate")
    ? startOfDay(parseISO(searchParams.get("startDate") as string))
    : null;
  const setStartDate = (date: Date | null) => {
    if (!date) {
      setSearchParams((params) => {
        params.delete("startDate");
        return params;
      });
    } else {
      setSearchParams((params) => {
        params.set("startDate", format(date, "yyyy-MM-dd"));
        params.delete("range");
        return params;
      });
    }
  };
  const endDate = searchParams.has("endDate")
    ? startOfDay(parseISO(searchParams.get("endDate") as string))
    : null;
  const setEndDate = (date: Date | null) => {
    if (!date) {
      setSearchParams((params) => {
        params.delete("endDate");
        return params;
      });
    } else {
      setSearchParams((params) => {
        params.set("endDate", format(date, "yyyy-MM-dd"));
        params.delete("range");
        return params;
      });
    }
  };
  const range = searchParams.get("range")?.toLowerCase();
  const setRange = (range: string | undefined) => {
    if (!range) {
      setSearchParams((params) => {
        params.delete("range");
        return params;
      });
    } else {
      setSearchParams((params) => {
        params.set("range", range.toLowerCase());
        params.delete("startDate");
        params.delete("endDate");
        return params;
      });
    }
  };

  return (
    <div className="w-full h-full">
      <div className="h-10 flex items-center w-full bg-slate-100 overflow-y-hidden overflow-x-auto pl-2 shadow-md">
        <Select
          value={eventType ?? "None"}
          onChange={(event: SelectChangeEvent) => {
            setSearchParams((params) => {
              const eventType =
                event.target.value === "None"
                  ? undefined
                  : event.target.value.toLowerCase();
              if (eventType) {
                params.set("type", eventType);
              }
              return params;
            });
          }}
          classes={{
            select: "pt-0 pb-0 w-30 h-7 flex items-center text-sm",
          }}
        >
          <MenuItem value={"None"}>
            <div className="text-zinc-400">None</div>
          </MenuItem>
          <Divider />
          <MenuItem value={BabyCareEventType.BOTTLE_FEED.toLowerCase()}>
            Bottle Feeding
          </MenuItem>
          <MenuItem value={BabyCareEventType.PUMPING.toLowerCase()}>
            Pumping
          </MenuItem>
          <MenuItem value={BabyCareEventType.NURSING.toLowerCase()}>
            Nursing
          </MenuItem>
        </Select>
        <Divider className="h-5 mx-2 " orientation="vertical" />
        <button
          className={cn(
            "h-7 w-7 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range ===
                BabyCareEventTimeSeriesStatsRange.ONE_WEEK.toLowerCase(),
            }
          )}
          onClick={() =>
            setRange(BabyCareEventTimeSeriesStatsRange.ONE_WEEK.toLowerCase())
          }
        >
          1W
        </button>
        <button
          className={cn(
            "h-7 w-7 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range ===
                BabyCareEventTimeSeriesStatsRange.ONE_MONTH.toLowerCase(),
            }
          )}
          onClick={() =>
            setRange(BabyCareEventTimeSeriesStatsRange.ONE_MONTH.toLowerCase())
          }
        >
          1M
        </button>
        <button
          className={cn(
            "h-7 w-7 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range ===
                BabyCareEventTimeSeriesStatsRange.THREE_MONTH.toLowerCase(),
            }
          )}
          onClick={() =>
            setRange(
              BabyCareEventTimeSeriesStatsRange.THREE_MONTH.toLowerCase()
            )
          }
        >
          3M
        </button>
        <button
          className={cn(
            "h-7 w-7 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range ===
                BabyCareEventTimeSeriesStatsRange.SIX_MONTH.toLowerCase(),
            }
          )}
          onClick={() =>
            setRange(BabyCareEventTimeSeriesStatsRange.SIX_MONTH.toLowerCase())
          }
        >
          6M
        </button>
        <button
          className={cn(
            "h-7 w-7 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range ===
                BabyCareEventTimeSeriesStatsRange.ONE_YEAR.toLowerCase(),
            }
          )}
          onClick={() =>
            setRange(BabyCareEventTimeSeriesStatsRange.ONE_YEAR.toLowerCase())
          }
        >
          1Y
        </button>
        <button
          className={cn(
            "h-7 w-10 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
            {
              "bg-blue-100 border-blue-500 hover:border-blue-500":
                range === undefined,
            }
          )}
          onClick={() => setRange(undefined)}
        >
          MAX
        </button>
        <Divider className="h-5 mx-2 " orientation="vertical" />
        <div className="flex items-center">
          <MobileDatePicker
            slotProps={{
              textField: {
                placeholder: "From",
                InputProps: {
                  classes: {
                    input:
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
              actionBar: {
                actions: ["cancel", "clear", "accept"],
              },
            }}
            {...pruneNullValues({ maxDate: endDate })}
            value={startDate}
            onAccept={(value: Date | null) => {
              setStartDate(value ? startOfDay(value) : null);
            }}
            format="MMM dd, EEE"
          />
          <button
            className={cn(
              "h-7 flex items-center px-0.5 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  startDate && isEqual(startDate, startOfDay(birthDate)),
              }
            )}
            onClick={() => setStartDate(birthDate)}
          >
            <ChildCareIcon className="text-slate-600" />
          </button>
          <div className="h-full flex items-center text-xl mx-2 text-slate-300 select-none">
            -
          </div>
          <MobileDatePicker
            slotProps={{
              textField: {
                placeholder: "To",
                InputProps: {
                  classes: {
                    input:
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
              actionBar: {
                actions: ["cancel", "clear", "accept"],
              },
            }}
            {...pruneNullValues({ minDate: startDate })}
            value={endDate}
            onAccept={(value: Date | null) => {
              setEndDate(value ? startOfDay(value) : null);
            }}
            format="MMM dd, EEE"
          />
        </div>
      </div>
      {!eventType && (
        <div className="h-[calc(100%_-_40px)] flex justify-center items-center font-medium text-slate-500 select-none text-sm">
          Select an event type to start
        </div>
      )}
      {eventType && (
        <div className="h-[calc(100%_-_40px)] overflow-x-auto">
          <BabyCareEventStatsDisplay
            profile={profile}
            eventType={eventType}
            stats={stats}
          />
        </div>
      )}
    </div>
  );
};
