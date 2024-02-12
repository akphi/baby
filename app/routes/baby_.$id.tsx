import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  type SerializeFrom,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareEventManager,
  type BabyCareProfile,
} from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSubmit,
} from "@remix-run/react";
import { HttpMethod, HttpStatus } from "../shared/NetworkUtils";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";
import { BabyCareEventGrid } from "./baby/BabyCareEventGrid";
import { parseISO } from "date-fns";
import { extractRequiredString } from "../shared/FormDataUtils";
import { BabyCareSummary } from "./baby/BabyCareSummary";
import {
  ControllerIcon,
  ClockIcon,
  SwitchProfileIcon,
  SyncIcon,
  ChildCareIcon,
  NotifyIcon,
  HistorySearchIcon,
  MoreVertIcon,
} from "../shared/Icons";
import { cn } from "../shared/StyleUtils";
import { useEffect, useState } from "react";
import { useBabyCareProfileSyncPulse } from "./baby/BabyCareDataSync";
import { BabyCareProfileEditor } from "./baby/BabyCareProfileEditor";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Home: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const events = await BabyCareDataRegistry.fetchEvents(
    profile,
    // NOTE: `date-fns` parseISO will return time in local timezone, which is what we pass in
    // if we use `new Date()` instead, it will be in UTC timezone and therefore, throw off the result
    date ? parseISO(date) : new Date()
  );
  const currentEvents = !date
    ? events
    : await BabyCareDataRegistry.fetchEvents(
        profile,
        // NOTE: `date-fns` parseISO will return time in local timezone, which is what we pass in
        // if we use `new Date()` instead, it will be in UTC timezone and therefore, throw off the result
        new Date()
      );
  return json({ profile, events, currentEvents });
};

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
    case BabyCareAction.CREATE_PLAY_EVENT:
    case BabyCareAction.CREATE_MEASUREMENT_EVENT:
    case BabyCareAction.CREATE_MEDICINE_EVENT:
    case BabyCareAction.CREATE_NOTE_EVENT: {
      const profileIdOrHandle = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.quickCreateEvent(
        action,
        profileIdOrHandle
      );
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT:
    case BabyCareAction.UPDATE_PUMPING_EVENT:
    case BabyCareAction.UPDATE_NURSING_EVENT:
    case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.UPDATE_SLEEP_EVENT:
    case BabyCareAction.UPDATE_BATH_EVENT:
    case BabyCareAction.UPDATE_PLAY_EVENT:
    case BabyCareAction.UPDATE_MEASUREMENT_EVENT:
    case BabyCareAction.UPDATE_MEDICINE_EVENT:
    case BabyCareAction.UPDATE_NOTE_EVENT: {
      const eventId = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.updateEvent(formData, eventId);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.REMOVE_BOTTLE_FEED_EVENT:
    case BabyCareAction.REMOVE_PUMPING_EVENT:
    case BabyCareAction.REMOVE_NURSING_EVENT:
    case BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.REMOVE_PLAY_EVENT:
    case BabyCareAction.REMOVE_BATH_EVENT:
    case BabyCareAction.REMOVE_SLEEP_EVENT:
    case BabyCareAction.REMOVE_MEASUREMENT_EVENT:
    case BabyCareAction.REMOVE_MEDICINE_EVENT:
    case BabyCareAction.REMOVE_NOTE_EVENT: {
      const eventId = extractRequiredString(formData, "id");
      const event = await BabyCareDataRegistry.removeEvent(action, eventId);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_PROFILE: {
      const { profile } = await BabyCareDataRegistry.createOrUpdateProfile(
        formData
      );
      return json({ profile }, HttpStatus.OK);
    }
    case BabyCareAction.REQUEST_ASSISTANT: {
      const profileIdOrHandle = extractRequiredString(formData, "id");
      await BabyCareEventManager.notificationService.requestAssistant(
        profileIdOrHandle
      );
    }
    default:
      return null;
  }
}

enum Activity {
  DASHBOARD = "Dashboard",
  EVENT_LOG = "Event Log",
}

export default function BabyCare() {
  const { profile, events, currentEvents } = useLoaderData<typeof loader>();
  const [currentActivity, setCurrentActivity] = useState<Activity>(
    Activity.DASHBOARD
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileToEdit, setProfileToEdit] = useState<
    SerializeFrom<BabyCareProfile> | undefined
  >(undefined);
  const [syncPulseData, clearDataSyncPulse] = useBabyCareProfileSyncPulse(
    profile.id
  );
  const submit = useSubmit();
  const revalidater = useRevalidator();

  useEffect(() => {
    if (syncPulseData && revalidater.state === "idle") {
      revalidater.revalidate();
      clearDataSyncPulse();
    }
  }, [syncPulseData, revalidater, clearDataSyncPulse]);

  return (
    <div className="h-full w-full bg-slate-50">
      <BabyCareSummary events={currentEvents} profile={profile} />
      <main className="w-full overflow-auto h-[calc(100%_-_80px)]">
        {/* empty toolbar to offset the content the height of the floating toolbar */}
        <div className="h-20 w-full" />
        <div className="h-[calc(100%_-_80px)] w-full">
          {currentActivity === Activity.DASHBOARD && (
            <BabyCareDashboard profile={profile} />
          )}
          {currentActivity === Activity.EVENT_LOG && (
            <BabyCareEventGrid profile={profile} events={events} />
          )}
        </div>
      </main>
      <div className="h-20 w-full flex justify-center items-end">
        <div className="flex h-14 items-center rounded-t-lg shadow-lg bg-white pl-4">
          <button
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-red-200 border-b-2 border-white"
            )}
            onClick={() => {
              submit(
                {
                  __action: BabyCareAction.REQUEST_ASSISTANT,
                  id: profile.id,
                },
                {
                  method: HttpMethod.POST,
                }
              );
            }}
          >
            <NotifyIcon className="text-4xl" />
          </button>
          <Divider
            orientation="vertical"
            className="bg-slate-50 h-8 opacity-50 mx-2"
          />
          <button
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white"
            )}
            onClick={() => setProfileToEdit(profile)}
          >
            <ChildCareIcon className="text-4xl" />
          </button>
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
          <Divider
            orientation="vertical"
            className="bg-slate-50 h-8 opacity-50 mx-2"
          />
          <button
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white"
            )}
            onClick={() => revalidater.revalidate()}
          >
            {/* TODO?: should we show some indicator when syncing fails or when it's deemed undesirable */}
            <SyncIcon
              className={cn("text-4xl", {
                "animate-spin": revalidater.state === "loading",
              })}
            />
          </button>
          <Divider
            orientation="vertical"
            className="bg-slate h-8 opacity-50 ml-2"
          />
          <button
            onClick={(event) => setAnchorEl(event.currentTarget)}
            className={cn(
              "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white"
            )}
          >
            <MoreVertIcon className="text-4xl" />
          </button>
          <Menu
            classes={{
              list: "min-w-48",
            }}
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
          >
            <Link to={`/baby`} className="h-full">
              <MenuItem>
                <ListItemIcon>
                  <SwitchProfileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Switch Profile</ListItemText>
              </MenuItem>
            </Link>
            <MenuItem>
              <ListItemIcon>
                <HistorySearchIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Event Lookup</ListItemText>
            </MenuItem>
          </Menu>
        </div>
        {profileToEdit && (
          <BabyCareProfileEditor
            open={Boolean(profileToEdit)}
            onClose={() => setProfileToEdit(undefined)}
            profile={profileToEdit}
            simple
          />
        )}
      </div>
    </div>
  );
}
