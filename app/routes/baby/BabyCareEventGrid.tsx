import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type BottleFeedEvent,
  type DiaperChangeEvent,
  type NursingEvent,
  type PumpingEvent,
  BabyCareAction,
} from "../../data/baby-care";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { add, format, isEqual, parseISO, startOfDay, sub } from "date-fns";
import {
  AddIcon,
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChildToyIcon,
  MoreVertIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  RemoveIcon,
  SleepIcon,
} from "../../shared/Icons";
import type { ICellRendererParams } from "@ag-grid-community/core";
import { useMemo, useState } from "react";
import { debounce, groupBy, merge } from "lodash-es";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { cn } from "../../shared/StyleUtils";
import { useSearchParams, useSubmit } from "@remix-run/react";
import { HttpMethod } from "../../shared/NetworkUtils";
import { useBooleanSetting } from "../../storage";
import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/base";
import { ConfirmationDialog } from "../../shared/ConfirmationDialog";

const GridNumberInput = (props: {
  value: number;
  setValue: (value: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  factor?: number;
  className?: string;
  children?: React.ReactNode;
}) => {
  const { min, max, step, unit, factor, value, setValue, className, children } =
    props;
  const _value = value / (factor ?? 1);

  const _setValue = (value: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    setValue(Math.max(_min, Math.min(_max, value)) * (factor ?? 1));
  };

  return (
    <div
      className={cn(
        "h-6 w-22 flex justify-center items-center text-slate-600 bg-slate-100 rounded relative",
        className
      )}
    >
      <button
        className="absolute h-full w-1/2 flex justify-start items-center pl-1 left-0"
        color="primary"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue(_value - (step ?? 1))}
      >
        <RemoveIcon className="text-2xs" />
      </button>
      <div className="w-full h-full flex rounded justify-center items-center">
        {children}
        <div className="flex items-center font-mono text-xs">{_value}</div>
        <div className="flex items-center font-mono text-2xs ml-0.5">
          {unit}
        </div>
      </div>
      <button
        className="absolute h-full w-1/2 flex justify-end items-center pr-1 right-0"
        color="primary"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue(_value + (step ?? 1))}
      >
        <AddIcon className="text-2xs" />
      </button>
    </div>
  );
};

const BottleFeedEventOverview = (props: {
  data: SerializeFrom<BottleFeedEvent>;
}) => {
  const { data } = props;
  const [volume, setVolume] = useState(data.volume);
  const [useMetric] = useBooleanSetting("unit.useMetric");
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_volume: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_BOTTLE_FEED_EVENT,
            ...data,
            volume: _volume,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <div className="flex items-center h-full w-full">
      <GridNumberInput
        value={volume}
        unit={useMetric ? "ml" : "oz"}
        step={5}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setVolume(value);
          debouncedUpdate(value);
        }}
      />
    </div>
  );
};

const PumpingEventOverview = (props: { data: SerializeFrom<PumpingEvent> }) => {
  const { data } = props;
  const [volume, setVolume] = useState(data.volume);
  const [useMetric] = useBooleanSetting("unit.useMetric");
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_volume: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_PUMPING_EVENT,
            ...data,
            volume: _volume,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <div className="flex items-center h-full w-full">
      <GridNumberInput
        value={volume}
        unit={useMetric ? "ml" : "oz"}
        step={5}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setVolume(value);
          debouncedUpdate(value);
        }}
      />
    </div>
  );
};

const NursingEventOverview = (props: { data: SerializeFrom<NursingEvent> }) => {
  const { data } = props;
  const [leftDuration, setLeftDuration] = useState(data.leftDuration);
  const [rightDuration, setRightDuration] = useState(data.rightDuration);
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_leftDuration: number, _rightDuration: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_NURSING_EVENT,
            ...data,
            leftDuration: _leftDuration,
            rightDuration: _rightDuration,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <div className="flex items-center h-full w-full overflow-x-auto overflow-y-hidden">
      <GridNumberInput
        value={leftDuration}
        unit={"mn"}
        factor={60 * 1000}
        step={1}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setLeftDuration(value);
          debouncedUpdate(value, rightDuration);
        }}
      >
        <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
          L
        </div>
      </GridNumberInput>
      <GridNumberInput
        value={rightDuration}
        unit={"mn"}
        factor={60 * 1000}
        step={1}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setRightDuration(value);
          debouncedUpdate(leftDuration, value);
        }}
        className="ml-2"
      >
        <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
          R
        </div>
      </GridNumberInput>
    </div>
  );
};

const EventOverview = (props: { data: SerializeFrom<BabyCareEvent> }) => {
  const { data } = props;

  switch (data?.type) {
    case BabyCareEventType.BOTTLE_FEED:
      return (
        <BottleFeedEventOverview
          data={data as SerializeFrom<BottleFeedEvent>}
        />
      );
    case BabyCareEventType.PUMPING:
      return (
        <PumpingEventOverview data={data as SerializeFrom<PumpingEvent>} />
      );
    case BabyCareEventType.NURSING:
      return (
        <NursingEventOverview data={data as SerializeFrom<NursingEvent>} />
      );
    default:
      // TODO: for these events, showing the tags and comments might be important
      return <div className="h-full w-full" />;
  }
};

const EventOverviewRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>> & {
    profile: SerializeFrom<BabyCareProfile>;
  }
) => {
  const data = params.data;
  const [showDeleteConfirmationDialog, setShowDeleteConfirmationDialog] =
    useState(false);
  const submit = useSubmit();

  if (!data) {
    return null;
  }
  return (
    <div className="flex items-center h-full w-full justify-between">
      <EventOverview data={data} />
      <Dropdown>
        <MenuButton
          className="flex items-center justify-center w-7 h-full"
          ref={(ref) => {
            if (!ref) {
              return;
            }
            ref.ondblclick = (e) => {
              e.stopPropagation();
            };
          }}
        >
          <MoreVertIcon className="text-lg text-slate-300 hover:text-slate-500" />
        </MenuButton>
        <Menu
          slots={{ listbox: "ol" }}
          className="bg-white cursor-pointer rounded shadow-md border"
        >
          <MenuItem
            className="flex items-center px-2 h-8 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => {
              /* od nothing */
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            className="flex items-center px-2 h-8 text-sm text-red-500 hover:bg-slate-100"
            onClick={() => setShowDeleteConfirmationDialog(true)}
          >
            Delete
          </MenuItem>
        </Menu>
      </Dropdown>
      {showDeleteConfirmationDialog && (
        <ConfirmationDialog
          open={showDeleteConfirmationDialog}
          onClose={() => setShowDeleteConfirmationDialog(false)}
          message="Are you sure you want to remove this event?"
          action={() => {
            let action: string;
            switch (data.type) {
              case BabyCareEventType.BOTTLE_FEED: {
                action = BabyCareAction.REMOVE_BOTTLE_FEED_EVENT;
                break;
              }
              case BabyCareEventType.PUMPING: {
                action = BabyCareAction.REMOVE_PUMPING_EVENT;
                break;
              }
              case BabyCareEventType.NURSING: {
                action = BabyCareAction.REMOVE_NURSING_EVENT;
                break;
              }
              case BabyCareEventType.DIAPER_CHANGE: {
                action = BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT;
                break;
              }
              case BabyCareEventType.PLAY: {
                action = BabyCareAction.REMOVE_PLAY_EVENT;
                break;
              }
              case BabyCareEventType.BATH: {
                action = BabyCareAction.REMOVE_BATH_EVENT;
                break;
              }
              case BabyCareEventType.SLEEP: {
                action = BabyCareAction.REMOVE_SLEEP_EVENT;
                break;
              }
              default:
                return;
            }
            submit(
              {
                __action: action,
                ...data,
              },
              { method: HttpMethod.POST }
            );
          }}
        />
      )}
    </div>
  );
};

const EventTypeRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>>
) => {
  const data = params.data;
  return (
    <div className="flex items-center h-full w-full">
      {data?.type === BabyCareEventType.BOTTLE_FEED && (
        <BottleIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.type === BabyCareEventType.NURSING && (
        <NursingIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.type === BabyCareEventType.PUMPING && (
        <BreastPumpIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.type === BabyCareEventType.DIAPER_CHANGE &&
        ((data as SerializeFrom<DiaperChangeEvent>).poop ? (
          <PoopIcon className="h-full w-5 flex items-center text-base" />
        ) : (
          <PeeIcon className="h-full w-5 flex items-center text-base" />
        ))}
      {data?.type === BabyCareEventType.SLEEP && (
        <SleepIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.type === BabyCareEventType.PLAY && (
        <ChildToyIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.type === BabyCareEventType.BATH && (
        <BathIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data && (
        <div className="flex items-center justify-center rounded uppercase ml-1 text-3xs font-medium leading-4 bg-slate-500 px-1 text-slate-100">
          {data.type === BabyCareEventType.DIAPER_CHANGE
            ? (data as SerializeFrom<DiaperChangeEvent>).poop
              ? BabyCareEventType.__POOP
              : BabyCareEventType.__PEE
            : data.type}
        </div>
      )}
    </div>
  );
};

export const BabyCareEventGrid = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { profile, events } = props;
  const [params] = useSearchParams();
  const submit = useSubmit();
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined
  );
  const [selectedDate, _setSelectedDate] = useState<Date>(
    startOfDay(
      params.has("date") ? parseISO(params.get("date") as string) : new Date()
    )
  );
  const setSelectedDate = (date: Date) => {
    submit(
      isEqual(date, startOfDay(new Date()))
        ? {}
        : { date: format(date, "yyyy-MM-dd") },
      {
        method: HttpMethod.GET,
      }
    );
    _setSelectedDate(startOfDay(date));
  };

  return (
    <div className="w-screen home__event-grid">
      <div className="flex items-center w-full bg-slate-100 border-t overflow-x-auto overflow-y-hidden">
        <div className="h-10 w-auto flex items-center px-2">
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
                      "py-0 px-2 w-16 h-7 text-slate-600 cursor-pointer text-sm",
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
            format="MMM dd"
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
                "bg-blue-100": isEqual(selectedDate, startOfDay(new Date())),
                "border-blue-500": isEqual(
                  selectedDate,
                  startOfDay(new Date())
                ),
                "hover:border-blue-500": isEqual(
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
        <div className="h-10 w-full flex items-center px-2 border-l">
          <button
            className={cn(
              "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300",
              {
                "bg-blue-100": selectedEvent === undefined,
                "border-blue-500": selectedEvent === undefined,
                "hover:border-blue-500": selectedEvent === undefined,
              }
            )}
            onClick={() => setSelectedEvent(undefined)}
          >
            <div className="font-medium text-slate-600 text-sm">ALL</div>
            <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
              {events.length}
            </div>
          </button>
          {Object.entries(
            merge(
              {
                [BabyCareEventType.BOTTLE_FEED]: 0,
                [BabyCareEventType.PUMPING]: 0,
                [BabyCareEventType.__POOP]: 0,
                [BabyCareEventType.__PEE]: 0,
                [BabyCareEventType.SLEEP]: 0,
                [BabyCareEventType.BATH]: 0,
                [BabyCareEventType.PLAY]: 0,
                [BabyCareEventType.NURSING]: 0,
              },
              groupBy(events, (event) =>
                event.type === BabyCareEventType.DIAPER_CHANGE
                  ? (event as SerializeFrom<DiaperChangeEvent>).poop
                    ? BabyCareEventType.__POOP
                    : BabyCareEventType.__PEE
                  : event.type
              )
            )
          ).map(([type, items]) => (
            <button
              key={type}
              onClick={() => setSelectedEvent(type)}
              className={cn(
                "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
                {
                  "bg-blue-100": selectedEvent === type,
                  "border-blue-500": selectedEvent === type,
                  "hover:border-blue-500": selectedEvent === type,
                }
              )}
            >
              <div className="h-full flex items-center justify-center">
                {type === BabyCareEventType.BOTTLE_FEED && (
                  <BottleIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.NURSING && (
                  <NursingIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.PUMPING && (
                  <BreastPumpIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.__PEE && (
                  <PeeIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.__POOP && (
                  <PoopIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.SLEEP && (
                  <SleepIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.PLAY && (
                  <ChildToyIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.BATH && (
                  <BathIcon className="home__event-grid__action-icon" />
                )}
              </div>
              <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
                {items.length ?? 0}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-quartz ">
        <AgGridReact
          headerHeight={0}
          gridOptions={{
            getRowId: (data) => data.data.id,
            suppressCellFocus: true,
            onRowDoubleClicked: (event) => {
              console.log(event);
              alert(event.event?.defaultPrevented);
              // TODO
            },
            rowStyle: { cursor: "pointer" },
          }}
          columnDefs={[
            {
              headerName: "Time",
              field: "time",
              resizable: false,
              width: 50,
              cellStyle: { textAlign: "center", fontSize: "12px" },
              suppressSizeToFit: true,
              cellClass: "text-slate-600 pr-0",
              valueFormatter: (params) =>
                format(new Date(params.value), "HH:mm"),
            },
            {
              headerName: "Type",
              field: "time",
              sortable: false,
              resizable: false,
              width: 75,
              cellClass: "px-0",
              suppressSizeToFit: true,
              cellRenderer: EventTypeRenderer,
            },
            {
              headerName: "Overview",
              field: "time",
              sortable: false,
              resizable: false,
              flex: 1,
              cellClass: "pr-0 pl-1",
              cellRendererParams: {
                profile,
              },
              cellRenderer: EventOverviewRenderer,
            },
          ]}
          domLayout="autoHeight"
          rowData={events.filter((event) => {
            switch (selectedEvent) {
              case undefined:
                return true;
              case BabyCareEventType.__POOP:
                return (
                  event.type === BabyCareEventType.DIAPER_CHANGE &&
                  (event as SerializeFrom<DiaperChangeEvent>).poop
                );
              case BabyCareEventType.__PEE:
                return (
                  event.type === BabyCareEventType.DIAPER_CHANGE &&
                  !(event as SerializeFrom<DiaperChangeEvent>).poop
                );
              default:
                return event.type === selectedEvent;
            }
          })}
          modules={[ClientSideRowModelModule]}
        ></AgGridReact>
      </div>
    </div>
  );
};
