import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareProfile,
  type BabyCareEventStats,
  type BabyCareEventTimeSeriesStats,
  type BottleFeedEventTimeSeriesStatsRecord,
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
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import { useEffect, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";

// TODO?: should we clean this up? is this side-effect?
ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  // NOTE: this requires access to window object, hence needs to render in client-only mode
  // See https://github.com/remix-run/remix/discussions/6424
  // See https://github.com/chartjs/chartjs-plugin-zoom/issues/742
  ZoomPlugin
);

const BabyCareTimeSeriesStatsDisplay = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  stats: SerializeFrom<BabyCareEventTimeSeriesStats>;
  eventType: string;
}) => {
  const { profile, stats, eventType } = props;
  // const [enableExpandedView, setEnableExpandedView] = useState(false);
  const { width, ref: chartContainerRef } = useResizeDetector<HTMLDivElement>({
    refreshMode: "debounce",
    refreshRate: 50,
  });
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  const plugin = {
    id: "verticalLiner",
    afterInit: (chart, args, opts) => {
      chart.verticalLiner = {};
    },
    afterEvent: (chart, args, options) => {
      const { inChartArea } = args;
      chart.verticalLiner = { draw: inChartArea };
    },
    beforeTooltipDraw: (chart, args, options) => {
      const { draw } = chart.verticalLiner;
      if (!draw) return;

      const { ctx } = chart;
      const { top, bottom } = chart.chartArea;
      const { tooltip } = args;
      const x = tooltip?.caretX;
      if (!x) return;

      ctx.save();

      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.restore();
    },
  };

  useEffect(() => {
    let chart: ChartJS | undefined = undefined;
    if (chartCanvasRef.current) {
      chart = new ChartJS(chartCanvasRef.current, {
        type: "line",
        data: {
          labels: stats.records.map((record) => record.t_label),
          datasets: [
            ...(eventType === BabyCareEventType.BOTTLE_FEED.toLowerCase()
              ? [
                  {
                    label: "sum_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .sum_volume
                    ),
                    fill: false,
                    borderColor: "#3b82f6",
                    tension: 0.5,
                  },
                  {
                    label: "avg_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .avg_volume
                    ),
                    fill: false,
                    borderColor: "#93c5fd",
                    tension: 0.5,
                  },
                  {
                    label: "sum_formula_milk_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .sum_formula_milk_volume
                    ),
                    fill: false,
                    borderColor: "#ec4899",
                    tension: 0.5,
                  },
                  {
                    label: "avg_formula_milk_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .avg_formula_milk_volume
                    ),
                    fill: false,
                    borderColor: "#f9a8d4",
                    tension: 0.5,
                  },
                ]
              : []),
            {
              label: "count",
              data: stats.records.map((record) => record.count),
              fill: false,
              borderColor: "#cbd5e1",
              tension: 0.5,
            },
          ],
        },
        options: {
          responsive: true,
          resizeDelay: 0,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: {
                display: false,
              },
              grid: {
                lineWidth: 0.5,
                // display: false, // SIMPLIFY
              },
            },
            y: {
              ticks: {
                display: false,
              },
              grid: {
                lineWidth: 0.5,
              },
            },
          },
          elements: {
            point: {
              radius: 1.5, // SIMPLIFY
            },
            line: {
              borderWidth: 1.5, // SIMPLIFY
            },
          },
          plugins: {
            verticalLiner: {},
            zoom: {
              pan: {
                enabled: true,
              },
              zoom: {
                wheel: {
                  enabled: true,
                  speed: 0.005,
                },
                pinch: {
                  enabled: true,
                },
                mode: "xy",
              },
            },
            legend: {
              display: false,
              // position: "bottom",
            },
            tooltip: {
              // enabled: total !== 0,
              usePointStyle: false,
              boxPadding: 5,
              callbacks: {
                labelPointStyle: () => ({
                  pointStyle: "rectRounded",
                  rotation: 0,
                }),
              },
            },
          },
        },
        plugins: [plugin],
      });
      chartRef.current = chart;
    }

    return () => {
      chart?.destroy();
    };
  }, [eventType, stats]);

  useEffect(() => {
    // if (width < stats.records.length * 15) {
    // }
    console.log(
      "asd",
      chartContainerRef.current,
      width,
      stats.records.length,
      chartContainerRef.current?.getBoundingClientRect().width
    );
  }, [chartContainerRef, width, stats]);

  return (
    <div ref={chartContainerRef} className="h-full w-full p-6">
      <button
        onClick={() => {
          chartRef.current?.resetZoom();
        }}
      >
        Reset Zoom
      </button>
      <canvas ref={chartCanvasRef} className="h-full w-full" />
    </div>
  );
};

const BabyCareEventStatsDisplay = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  eventType: string;
  stats: SerializeFrom<BabyCareEventStats>;
}) => {
  const { profile, eventType, stats } = props;

  switch (eventType) {
    case BabyCareEventType.BOTTLE_FEED.toLowerCase():
    case BabyCareEventType.NURSING.toLowerCase():
    case BabyCareEventType.PUMPING.toLowerCase(): {
      return (
        <BabyCareTimeSeriesStatsDisplay
          profile={profile}
          eventType={eventType}
          stats={stats as SerializeFrom<BabyCareEventTimeSeriesStats>}
        />
      );
    }
    default:
      return (
        <div className="h-full flex justify-center items-center font-medium text-slate-500 select-none text-sm">
          {`Can't display stats`}
        </div>
      );
  }
};

export const BabyCareEventTrend = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  stats: SerializeFrom<BabyCareEventStats>;
}) => {
  const { profile, stats } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const eventType = searchParams.get("type");
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
    }
    if (date && !isEqual(date, startOfDay(new Date()))) {
      setSearchParams((params) => {
        params.set("startDate", format(date, "yyyy-MM-dd"));
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
    }
    if (date && !isEqual(date, startOfDay(new Date()))) {
      setSearchParams((params) => {
        params.set("endDate", format(date, "yyyy-MM-dd"));
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
