import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type BottleFeedEvent,
  type PumpingEvent,
  type NursingEvent,
} from "../../data/baby-care";
import { useFetcher, useSubmit } from "@remix-run/react";
import {
  AddIcon,
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChildToyIcon,
  CloseIcon,
  DeleteIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  RemoveIcon,
  SleepIcon,
} from "../../shared/Icons";
import { CircularProgress, Fade, IconButton, Snackbar } from "@mui/material";
import { HttpMethod } from "../../shared/NetworkUtils";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "lodash-es";
import { isNonNullable } from "../../shared/AssertionUtils";
import { cn } from "../../shared/StyleUtils";
import { pruneFormData } from "../../shared/FormDataUtils";

const InlineNumberInput = (props: {
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
  const _value = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const _setValue = (value: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    setValue(Math.max(_min, Math.min(_max, value)) * (factor ?? 1));
  };

  return (
    <div
      className={cn(
        "h-8 w-24 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded relative",
        className
      )}
    >
      <button
        className="absolute h-full w-4 flex justify-start items-center pl-1 left-0"
        onClick={() => _setValue((_value ?? 0) - (step ?? 1))}
      >
        <RemoveIcon className="text-xs" />
      </button>
      <div className="w-full h-full flex rounded justify-center items-center">
        {children}
        <div className="flex items-center font-mono text-sm">{_value}</div>
        <div className="flex items-center font-mono text-xs ml-0.5">{unit}</div>
      </div>
      <button
        className="absolute h-full w-1/2 flex justify-end items-center pr-1 right-0"
        onClick={() => _setValue((_value ?? 0) + (step ?? 1))}
      >
        <AddIcon className="text-xs" />
      </button>
    </div>
  );
};

const QUICK_EDIT_TIMEOUT = 30 * 1000; // 30 seconds
const QUICK_EDIT_TIMER_INTERVAL = 250; // 250ms
const QUICK_EDIT_DELETE_BUTTON_HOLD_TIMER_INTERVAL = 1.5 * 1000; // 1.5 second

const EventQuickEditAction = forwardRef(
  (
    props: {
      data: SerializeFrom<BabyCareEvent>;
      onClose: () => void;
    },
    ref
  ) => {
    const { data, onClose } = props;
    const submit = useSubmit();
    const [autoCloseTimerCounter, setAutoCloseTimerCounter] = useState(0);
    const autoCloseTimer = useRef<NodeJS.Timeout>();
    const [deleteButtonHoldTimerCounter, setDeleteButtonHoldTimerCounter] =
      useState(0);
    const deleteButtonHoldTimer = useRef<NodeJS.Timeout>();

    useEffect(() => {
      autoCloseTimer.current = setInterval(() => {
        setAutoCloseTimerCounter(
          (value) =>
            value + 100 / (QUICK_EDIT_TIMEOUT / QUICK_EDIT_TIMER_INTERVAL)
        );
      }, QUICK_EDIT_TIMER_INTERVAL);
      return () => clearInterval(autoCloseTimer.current);
    }, []);

    useEffect(() => {
      if (autoCloseTimerCounter > 100) {
        onClose();
        return () => setAutoCloseTimerCounter(0);
      }
    }, [autoCloseTimerCounter, onClose]);

    useEffect(() => {
      if (deleteButtonHoldTimerCounter > 100) {
        if (data) {
          let action: string;
          switch (data.TYPE) {
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
        }
        onClose();

        return () => {
          setDeleteButtonHoldTimerCounter(0);
          clearInterval(deleteButtonHoldTimer.current);
        };
      }
    }, [data, deleteButtonHoldTimerCounter, onClose, submit]);

    function holdDelete() {
      const startTime = Date.now();
      deleteButtonHoldTimer.current = setInterval(() => {
        // NOTE: compared to how we do the other timer, this might be slightly
        // more reliable since it's based of Date.now() instead of an incrementer
        setDeleteButtonHoldTimerCounter(
          () =>
            ((Date.now() - startTime) /
              QUICK_EDIT_DELETE_BUTTON_HOLD_TIMER_INTERVAL) *
            100
        );
      }, 250);
    }

    function unholdDelete() {
      setDeleteButtonHoldTimerCounter(0);
      clearInterval(deleteButtonHoldTimer.current);
    }

    const [volume, setVolume] = useState(
      (data as SerializeFrom<BottleFeedEvent | PumpingEvent>).volume
    );
    const [leftDuration, setLeftDuration] = useState(
      (data as SerializeFrom<NursingEvent>).leftDuration
    );
    const [rightDuration, setRightDuration] = useState(
      (data as SerializeFrom<NursingEvent>).rightDuration
    );

    const debouncedUpdate = useMemo(
      () =>
        debounce(
          (formData: {
            volume?: number | undefined;
            leftDuration?: number | undefined;
            rightDuration?: number | undefined;
          }) => {
            let action: string;
            switch (data.TYPE) {
              case BabyCareEventType.BOTTLE_FEED: {
                action = BabyCareAction.UPDATE_BOTTLE_FEED_EVENT;
                break;
              }
              case BabyCareEventType.PUMPING: {
                action = BabyCareAction.UPDATE_PUMPING_EVENT;
                break;
              }
              case BabyCareEventType.NURSING: {
                action = BabyCareAction.UPDATE_NURSING_EVENT;
                break;
              }
              default:
                return;
            }
            submit(
              pruneFormData({
                __action: action,
                ...data,
                volume: formData?.volume,
                leftDuration: formData?.leftDuration,
                rightDuration: formData?.rightDuration,
              }),
              { method: HttpMethod.POST }
            );
          },
          200
        ),
      [submit, data]
    );

    return (
      <div
        ref={ref as any}
        className="flex items-center justify-between w-full h-full shadow-md shadow-slate-300 rounded bg-slate-700 select-none"
      >
        <div className="pl-4 md:px-4">
          <div className="w-full h-full flex items-center">
            {(data.TYPE === BabyCareEventType.BOTTLE_FEED ||
              data.TYPE === BabyCareEventType.PUMPING) && (
              <InlineNumberInput
                value={volume}
                unit={"ml"}
                step={5}
                setValue={(value) => {
                  debouncedUpdate.cancel();
                  setVolume(value);
                  debouncedUpdate({ volume: value });
                }}
                className="mr-2"
              />
            )}
            {data.TYPE === BabyCareEventType.NURSING && (
              <>
                <InlineNumberInput
                  value={leftDuration}
                  unit={"mn"}
                  factor={60 * 1000}
                  step={1}
                  setValue={(value) => {
                    debouncedUpdate.cancel();
                    setLeftDuration(value);
                    debouncedUpdate({ leftDuration: value, rightDuration });
                  }}
                  className="mr-2"
                >
                  <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
                    L
                  </div>
                </InlineNumberInput>
                <InlineNumberInput
                  value={rightDuration}
                  unit={"mn"}
                  factor={60 * 1000}
                  step={1}
                  setValue={(value) => {
                    debouncedUpdate.cancel();
                    setRightDuration(value);
                    debouncedUpdate({ leftDuration, rightDuration: value });
                  }}
                  className="mr-2"
                >
                  <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
                    R
                  </div>
                </InlineNumberInput>
              </>
            )}
          </div>
        </div>
        <div className="flex relative h-14">
          <div className="h-full w-10 flex items-center justify-center">
            <CircularProgress
              size={36}
              thickness={5}
              variant="determinate"
              value={100}
              classes={{
                root: "absolute",
                circleDeterminate: "text-slate-500",
              }}
            />
            <CircularProgress
              size={36}
              thickness={5}
              variant="determinate"
              value={deleteButtonHoldTimerCounter}
              classes={{
                circleDeterminate: "text-red-500",
              }}
            />
            <button
              className="absolute w-10 h-full bg-transparent"
              onMouseDown={holdDelete}
              onMouseUp={unholdDelete}
              onTouchStart={holdDelete}
              onTouchEnd={unholdDelete}
            >
              <DeleteIcon className="text-slate-500 hover:text-slate-200 text-2xl" />
            </button>
          </div>
          <div className="h-full w-14 flex items-center justify-center">
            <CircularProgress
              size={36}
              thickness={5}
              variant="determinate"
              value={100}
              classes={{
                root: "absolute",
                circleDeterminate: "text-slate-500",
              }}
            />
            <CircularProgress
              size={36}
              thickness={5}
              variant="determinate"
              value={autoCloseTimerCounter}
              classes={{
                circleDeterminate: "text-sky-500",
              }}
            />
            <button
              className="absolute w-14 h-full bg-transparent"
              onClick={() => onClose()}
            >
              <CloseIcon className="text-slate-500 hover:text-slate-200" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

const EventQuickEdit = (props: {
  data: SerializeFrom<BabyCareEvent> | undefined;
  onClose: () => void;
}) => {
  const { data, onClose } = props;

  return (
    <Snackbar
      open={Boolean(data)}
      TransitionComponent={Fade as any}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      className="w-full md:w-auto p-2 bottom-14 left-0 right-0 md:left-[unset]"
    >
      {data ? <EventQuickEditAction data={data} onClose={onClose} /> : <div />}
    </Snackbar>
  );
};

export const BabyCareDashboard = (props: {
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { profile } = props;
  const fetcher = useFetcher<{ event: SerializeFrom<BabyCareEvent> }>();
  const [eventToQuickEdit, setEventToQuickEdit] = useState<
    SerializeFrom<BabyCareEvent> | undefined
  >(undefined);

  useEffect(() => {
    if (
      fetcher.data &&
      (
        [
          BabyCareEventType.BOTTLE_FEED,
          BabyCareEventType.NURSING,
          BabyCareEventType.PUMPING,
        ] as string[]
      ).includes(fetcher.data.event.TYPE)
    ) {
      setEventToQuickEdit(fetcher.data.event);
    }
  }, [fetcher.data]);

  return (
    <div className="flex justify-center items-center w-full p-6">
      <div className="flex flex-col justify-center items-center p-6 bg-white rounded-xl shadow-md w-fit">
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_BOTTLE_FEED_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BottleIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_NURSING_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <NursingIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_PUMPING_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BreastPumpIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl text-black" />
          </IconButton>
        </div>
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <PoopIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-amber-100 border-amber-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <PeeIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-amber-100 border-amber-500 text-5xl text-black" />
          </IconButton>
          <IconButton className="w-24 h-24 invisible" />
        </div>
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_PLAY_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <ChildToyIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_BATH_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BathIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  __action: BabyCareAction.CREATE_SLEEP_EVENT,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <SleepIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl text-black" />
          </IconButton>
          <EventQuickEdit
            key={eventToQuickEdit?.id}
            data={eventToQuickEdit}
            onClose={() => setEventToQuickEdit(undefined)}
          />
        </div>
      </div>
    </div>
  );
};
