import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
} from "../../data/baby-care";
import { useFetcher } from "@remix-run/react";
import {
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChildToyIcon,
  CloseIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  SleepIcon,
} from "../../shared/Icons";
import { CircularProgress, IconButton, Popper } from "@mui/material";
import { HttpMethod } from "../../shared/NetworkUtils";
import { useEffect, useRef, useState } from "react";

const QUICK_EDIT_TIMEOUT = 10 * 1000; // 10 seconds
const QUICK_EDIT_TIMER_STEP_SIZE = 100;

const EventQuickEdit = (props: {
  event: SerializeFrom<BabyCareEvent>;
  onClose: () => void;
}) => {
  const { event, onClose } = props;
  const [counter, setCounter] = useState(0);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timer.current = setInterval(() => {
      setCounter((value) => value + 100 / QUICK_EDIT_TIMER_STEP_SIZE);
    }, QUICK_EDIT_TIMEOUT / QUICK_EDIT_TIMER_STEP_SIZE);
    return () => clearInterval(timer.current);
  }, []);

  useEffect(() => {
    if (counter >= 100) {
      onClose();
    }
  }, [counter, onClose]);

  return (
    <Popper
      open={Boolean(event)}
      anchorEl={{
        getBoundingClientRect: () => ({
          ...window.document.body.getBoundingClientRect(),
        }),
      }} // place it relative to the screen
      placement="top"
      className="w-full h-16 px-2 pb-2 right-0 left-0"
    >
      <div className="flex items-center justify-between w-full h-full shadow-md shadow-slate-300 rounded border border-slate-200 bg-white">
        <div className="pl-4">asd</div>
        <div className="h-14 w-14 flex items-center justify-center relative">
          <CircularProgress
            size={36}
            thickness={5}
            variant="determinate"
            value={100}
            classes={{
              root: "absolute",
              circleDeterminate: "text-slate-100",
            }}
          />
          <CircularProgress
            size={36}
            thickness={5}
            variant="determinate"
            value={counter}
          />
          <button className="absolute" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>
    </Popper>
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
          BabyCareEventType.DIAPER_CHANGE,
        ] as string[]
      ).includes(fetcher.data.event.TYPE)
    ) {
      setEventToQuickEdit(fetcher.data.event);
    }
  }, [fetcher.data]);

  return (
    <div className="flex justify-center items-center w-full p-6 bg-slate-50">
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
          {eventToQuickEdit && (
            <EventQuickEdit
              key={eventToQuickEdit.id} // force re-mount everytime the event changes
              event={eventToQuickEdit}
              onClose={() => setEventToQuickEdit(undefined)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
