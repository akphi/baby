import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareProfile,
  type BabyCareEventTimeSeriesStats,
  type BottleFeedEventTimeSeriesStatsRecord,
  type PumpingEventTimeSeriesStatsRecord,
  type NursingEventTimeSeriesStatsRecord,
  BabyCareEventTimeSeriesStatsFrequency,
} from "../../data/BabyCare";
import { add, format, parse } from "date-fns";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { Button, IconButton, Menu, MenuItem } from "@mui/material";
import { cn } from "../../shared/StyleUtils";
import { ZoomOffIcon } from "../../shared/Icons";
import { Chart as ChartJS, type Plugin } from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import AnnotationPlugin from "chartjs-plugin-annotation";
import { useEffect, useRef, useState } from "react";
import { guaranteeNonNullable } from "../../shared/AssertionUtils";

// NOTE: this requires access to window object, hence needs to render in client-only mode
// See https://github.com/remix-run/remix/discussions/6424
// See https://github.com/chartjs/chartjs-plugin-zoom/issues/742
ChartJS.register(ZoomPlugin);
ChartJS.register(AnnotationPlugin);

const HoverLinePlugin: Plugin<
  "line",
  {
    setTooltipDataIndex: (index: number | undefined) => void;
  }
> = {
  id: "hoverLine",
  afterInit: (chart, args, options) => {
    chart.hoverLine = {};
  },
  afterEvent: (chart, args, options) => {
    const { inChartArea } = args;
    chart.hoverLine = { display: inChartArea };
  },
  beforeTooltipDraw: (chart, args, options) => {
    if (!chart.hoverLine?.display) {
      options.setTooltipDataIndex(undefined);
      return;
    }

    const { ctx } = chart;
    const { top, bottom } = chart.chartArea;
    const { tooltip } = args;
    const x = tooltip?.caretX;
    if (!x) {
      return;
    }

    ctx.save();

    ctx.beginPath();
    ctx.setLineDash([2.5, 2.5]);
    ctx.strokeStyle = "#9CA3AF"; // tailwind gray-400
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    ctx.restore();

    options.setTooltipDataIndex(tooltip.dataPoints[0]?.dataIndex);
  },
};

const BabyCareTimeSeriesStatsDisplayHeader = (props: {
  stats: SerializeFrom<BabyCareEventTimeSeriesStats>;
  eventType: string;
  tooltipDataIndex: number | undefined;
}) => {
  const { stats, eventType, tooltipDataIndex } = props;
  const data = stats.records[tooltipDataIndex ?? stats.records.length - 1];

  if (!data) {
    return (
      <div className="h-full w-full text-slate-700 flex items-center font-bold text-4xl font-mono">
        No Data
      </div>
    );
  }
  return (
    <div className="h-full w-full text-slate-700 select-none">
      <div className="h-10 w-full flex flex-shrink-0 items-center">
        <div className="text-3xl font-bold font-mono">{data.t_diff_label}</div>
        <div className="h-8 px-4 flex items-center ml-4 rounded-full font-bold font-mono bg-slate-200 text-slate-500">
          {data.t_label}
        </div>
      </div>
      <div className="h-6 w-full flex items-center font-mono text-2xs whitespace-nowrap overflow-x-auto">
        {eventType === BabyCareEventType.BOTTLE_FEED.toLowerCase() && (
          <>
            <div>
              {`Vol: ${
                (data as BottleFeedEventTimeSeriesStatsRecord).sum_volume
              }ml`}
            </div>
            <div className="ml-4">
              {`Avg. Vol: ${
                (data as BottleFeedEventTimeSeriesStatsRecord).avg_volume
              }ml`}
            </div>
            <div className="ml-4">
              {`Formula: ${
                (data as BottleFeedEventTimeSeriesStatsRecord)
                  .sum_formula_milk_volume
              }ml`}
            </div>
            <div className="ml-4">
              {`Avg. Formula: ${
                (data as BottleFeedEventTimeSeriesStatsRecord)
                  .avg_formula_milk_volume
              }ml`}
            </div>
          </>
        )}
        {eventType === BabyCareEventType.PUMPING.toLowerCase() && (
          <>
            <div>
              {`Vol: ${
                (data as PumpingEventTimeSeriesStatsRecord).sum_volume
              }ml`}
            </div>
            <div className="ml-4">
              {`Avg. Vol: ${
                (data as PumpingEventTimeSeriesStatsRecord).avg_volume
              }ml`}
            </div>
          </>
        )}
        {eventType === BabyCareEventType.NURSING.toLowerCase() && (
          <>
            <div>
              {`Duration: ${
                (data as NursingEventTimeSeriesStatsRecord).sum_duration
              }h`}
            </div>
            <div className="ml-4">
              {`Avg. Duration: ${
                (data as NursingEventTimeSeriesStatsRecord).avg_duration
              }h`}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const BabyCareTimeSeriesStatsDisplay = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  stats: SerializeFrom<BabyCareEventTimeSeriesStats>;
  eventType: string;
}) => {
  const { profile, stats, eventType } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // frequency
  const frequency = searchParams.get("frequency")?.toLowerCase();
  const setFrequency = (frequency: string | undefined) => {
    if (!frequency) {
      setSearchParams((params) => {
        params.delete("frequency");
        return params;
      });
    } else {
      setSearchParams((params) => {
        params.set("frequency", frequency.toLowerCase());
        return params;
      });
    }
  };

  // chart
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showClickCursor, setShowClickCursor] = useState(false);
  const [tooltipDataIndex, setTooltipDataIndex] = useState<
    number | undefined
  >();
  const [chart, setChart] = useState<ChartJS | undefined>();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomer, setZoomer] = useState<null | HTMLElement>(null);

  useEffect(() => {
    let newChart: ChartJS | undefined = undefined;
    const _chartCanvasRef = chartCanvasRef.current;

    if (chartCanvasRef.current) {
      newChart = new ChartJS(chartCanvasRef.current, {
        type: "line",
        data: {
          labels: stats.records.map((record) => record.t_diff),
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
                    borderColor: "#3b82f6", // tailwind blue-500
                    tension: 0.5,
                  },
                  {
                    label: "avg_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .avg_volume
                    ),
                    borderColor: "#93c5fd", // tailwind blue-300
                    tension: 0.5,
                  },
                  {
                    label: "sum_formula_milk_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .sum_formula_milk_volume
                    ),
                    borderColor: "#ec4899", // tailwind pink-500
                    tension: 0.5,
                  },
                  {
                    label: "avg_formula_milk_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as BottleFeedEventTimeSeriesStatsRecord)
                          .avg_formula_milk_volume
                    ),
                    borderColor: "#f9a8d4", // tailwind pink-300
                    tension: 0.5,
                  },
                ]
              : []),
            ...(eventType === BabyCareEventType.PUMPING.toLowerCase()
              ? [
                  {
                    label: "sum_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as PumpingEventTimeSeriesStatsRecord).sum_volume
                    ),
                    borderColor: "#3b82f6", // tailwind blue-500
                    tension: 0.5,
                  },
                  {
                    label: "avg_volume",
                    data: stats.records.map(
                      (record) =>
                        (record as PumpingEventTimeSeriesStatsRecord).avg_volume
                    ),
                    borderColor: "#93c5fd", // tailwind blue-300
                    tension: 0.5,
                  },
                ]
              : []),
            ...(eventType === BabyCareEventType.NURSING.toLowerCase()
              ? [
                  {
                    label: "sum_duration",
                    data: stats.records.map(
                      (record) =>
                        (record as NursingEventTimeSeriesStatsRecord)
                          .sum_duration
                    ),
                    borderColor: "#3b82f6", // tailwind blue-500
                    tension: 0.5,
                  },
                  {
                    label: "avg_duration",
                    data: stats.records.map(
                      (record) =>
                        (record as NursingEventTimeSeriesStatsRecord)
                          .avg_duration
                    ),
                    borderColor: "#93c5fd", // tailwind blue-300
                    tension: 0.5,
                  },
                ]
              : []),
          ],
        },
        options: {
          responsive: true,
          resizeDelay: 0,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "linear",
              border: {
                display: false,
              },
              ticks: {
                display: false,
              },
              grid: {
                tickLength: 0,
                color: "#d1d5db", // tailwind gray-300
                lineWidth: 0.5,
              },
            },
            y: {
              type: "linear",
              border: {
                display: false,
              },
              ticks: {
                display: false,
              },
              grid: {
                tickLength: 0,
                color: "#d1d5db", // tailwind gray-300
                lineWidth: 0.5,
              },
            },
          },
          elements: {
            point: {
              hoverRadius: 3,
              radius: 1.5,
            },
            line: {
              borderWidth: 1.5,
            },
          },
          plugins: {
            annotation: {
              annotations: {
                currentTimeBox: {
                  // Indicates the type of annotation
                  type: "box",
                  backgroundColor: "#fffbebdd", // tailwind amber-50
                  borderWidth: 0.5,
                  borderColor: "#fcd34ddd", // tailwind amber-300
                  xMin: 87.5,
                  xMax: 88.5,
                  drawTime: "beforeDraw", // put the annotation behind the datasets
                },
              },
            },
            zoom: {
              pan: {
                enabled: true,
                onPan: () => setIsPanning(true),
                onPanComplete: () => setIsPanning(false),
              },
              limits: {
                x: {
                  min: -1,
                },
                y: {
                  min: 0,
                },
              },
              zoom: {
                wheel: {
                  enabled: true,
                  speed: 0.01,
                },
                pinch: {
                  enabled: true,
                },
                // drag and area to zoom
                drag: {
                  enabled: true,
                  modifierKey: "shift",
                },
                mode: "xy",
                onZoomComplete: (context) => {
                  setZoomLevel(context.chart.getZoomLevel());
                },
              },
            },
            // custom plugin to render hover line instead of default tooltip
            hoverLine: {
              setTooltipDataIndex,
            },
            tooltip: {
              intersect: false,
              mode: "index", // report multiple time series
              // all of these settings below are meant to make the default tooltip invisible
              // as will just render the hover line instead
              boxWidth: 0,
              boxHeight: 0,
              padding: 0,
              caretSize: 0,
              cornerRadius: 0,
              callbacks: {
                title: () => "",
                label: () => "",
              },
            },
          },
        },
        plugins: [HoverLinePlugin],
      });
      guaranteeNonNullable(_chartCanvasRef).ondblclick = (event) => {
        const items = newChart?.getElementsAtEventForMode(
          event,
          "nearest",
          {
            intersect: true,
          },
          true
        );
        if (items?.length) {
          const item = guaranteeNonNullable(items[0]);
          const record = guaranteeNonNullable(stats.records[item.index]);
          let startDate: Date | undefined;
          let endDate: Date | undefined;
          switch (
            frequency === undefined
              ? BabyCareEventTimeSeriesStatsFrequency.WEEKLY.toLowerCase()
              : frequency
          ) {
            case BabyCareEventTimeSeriesStatsFrequency.DAILY.toLowerCase(): {
              startDate = parse(record.t_label, "dd MMM yyyy", new Date());
              endDate = startDate;
              break;
            }
            case BabyCareEventTimeSeriesStatsFrequency.WEEKLY.toLowerCase(): {
              startDate = parse(record.t_label, "dd MMM yyyy", new Date());
              endDate = add(startDate, { days: 6 });
              break;
            }
            case BabyCareEventTimeSeriesStatsFrequency.MONTHLY.toLowerCase(): {
              startDate = parse(
                `01 ${record.t_label}`,
                "dd MMM yyyy",
                new Date()
              );
              endDate = add(startDate, { months: 1, days: -1 });
              break;
            }
            default: {
              startDate = undefined;
              endDate = undefined;
              break;
            }
          }

          if (startDate && endDate) {
            navigate({
              pathname: `/baby/${profile.id}/search`,
              search: `?type=${eventType}&startDate=${format(
                startDate,
                "yyyy-MM-dd"
              )}&endDate=${format(startDate, "yyyy-MM-dd")}`,
            });
          }
        }
      };
      guaranteeNonNullable(_chartCanvasRef).onmousemove = (event) => {
        const items = newChart?.getElementsAtEventForMode(
          event,
          "nearest",
          {
            intersect: true,
          },
          true
        );
        setShowClickCursor(Boolean(items?.length));
      };
      guaranteeNonNullable(_chartCanvasRef).onmousedown = (event) => {
        setIsPanning(true);
      };
      guaranteeNonNullable(_chartCanvasRef).onmouseup = (event) => {
        setIsPanning(false);
      };
      setChart(newChart);
    }

    return () => {
      if (_chartCanvasRef) {
        _chartCanvasRef.ondblclick = null;
        _chartCanvasRef.onmousemove = null;
        _chartCanvasRef.onmousedown = null;
        _chartCanvasRef.onmouseup = null;
      }
      setChart(undefined);
      newChart?.destroy();
    };
  }, [profile, eventType, frequency, stats, navigate]);

  return (
    <div className="h-full w-full px-4 py-2">
      <div className="h-16 flex">
        <BabyCareTimeSeriesStatsDisplayHeader
          stats={stats}
          eventType={eventType}
          tooltipDataIndex={tooltipDataIndex}
        />
      </div>
      <div
        className={cn("h-[calc(100%_-_104px)] w-full hover:cursor-crosshair", {
          "hover:cursor-grab": isPanning,
          "hover:cursor-pointer": showClickCursor,
        })}
      >
        <canvas ref={chartCanvasRef} tabIndex={0} />
      </div>
      <div className="h-10 flex justify-between items-center">
        <div className="flex">
          <button
            className={cn(
              "h-7 px-2 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  frequency ===
                  BabyCareEventTimeSeriesStatsFrequency.DAILY.toLowerCase(),
              }
            )}
            onClick={() =>
              setFrequency(
                BabyCareEventTimeSeriesStatsFrequency.DAILY.toLowerCase()
              )
            }
          >
            Daily
          </button>
          <button
            className={cn(
              "h-7 px-2 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  frequency === undefined || frequency === "weekly",
              }
            )}
            onClick={() => setFrequency(undefined)}
          >
            Weekly
          </button>
          <button
            className={cn(
              "h-7 px-2 flex flex-shrink-0 items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono ml-1",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  frequency ===
                  BabyCareEventTimeSeriesStatsFrequency.MONTHLY.toLowerCase(),
              }
            )}
            onClick={() =>
              setFrequency(
                BabyCareEventTimeSeriesStatsFrequency.MONTHLY.toLowerCase()
              )
            }
          >
            Monthly
          </button>
        </div>
        <div className="h-full flex items-center">
          <Button
            className="min-w-0 h-7 flex items-center justify-center rounded border-2 border-slate-200 hover:border-slate-300 text-xs font-mono"
            onClick={(event) => setZoomer(event.currentTarget)}
          >
            {Math.round(zoomLevel * 100)}%
          </Button>
          <Menu
            anchorEl={zoomer}
            open={Boolean(zoomer)}
            onClose={() => setZoomer(null)}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
          >
            <MenuItem
              onClick={() => {
                chart?.zoom(0.25);
                setZoomer(null);
              }}
            >
              25%
            </MenuItem>
            <MenuItem
              onClick={() => {
                chart?.zoom(0.5);
                setZoomer(null);
              }}
            >
              50%
            </MenuItem>
            <MenuItem
              onClick={() => {
                chart?.zoom(1);
                setZoomer(null);
              }}
            >
              100%
            </MenuItem>
            <MenuItem
              onClick={() => {
                chart?.zoom(1.25);
                setZoomer(null);
              }}
            >
              125%
            </MenuItem>
            <MenuItem
              onClick={() => {
                chart?.zoom(1.5);
                setZoomer(null);
              }}
            >
              150%
            </MenuItem>
            <MenuItem
              onClick={() => {
                chart?.zoom(1.75);
                setZoomer(null);
              }}
            >
              175%
            </MenuItem>
            {/*
              NOTE: there seems to be a problem with programtic zoom for zoom-level >= 2
              See https://github.com/chartjs/chartjs-plugin-zoom/issues/690
              Though the bug is claimed to have been fixed, something is still off
            */}
          </Menu>
          <IconButton
            className="h-8 w-8 flex flex-shrink-0 items-center justify-center"
            color="primary"
            onClick={() => {
              chart?.resetZoom();
              chartCanvasRef.current?.focus();
            }}
            disabled={!chart?.isZoomedOrPanned()}
          >
            <ZoomOffIcon className="text-lg" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
