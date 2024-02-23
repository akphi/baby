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
  NavLink,
  Outlet,
  useLoaderData,
  useRevalidator,
  useSubmit,
} from "@remix-run/react";
import { HttpMethod, HttpStatus } from "../shared/NetworkUtils";
import { extractRequiredString } from "../shared/FormDataUtils";
import { BabyCareSummary } from "./baby/BabyCareSummary";
import {
  ControllerIcon,
  SwitchProfileIcon,
  SyncIcon,
  ChildCareIcon,
  NotifyIcon,
  HistorySearchIcon,
  MoreVertIcon,
  ClockIcon,
  AnalyticsIcon,
} from "../shared/Icons";
import { cn } from "../shared/StyleUtils";
import { useEffect, useState } from "react";
import { useBabyCareProfileSyncPulse } from "./baby/BabyCareDataSync";
import { BabyCareProfileEditor } from "./baby/BabyCareProfileEditor";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Baby: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );
  const events = await BabyCareDataRegistry.fetchEvents(profile, new Date());
  return json({ profile, events });
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
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

export default function BabyCare() {
  const { profile, events } = useLoaderData<typeof loader>();
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
      <BabyCareSummary events={events} profile={profile} />
      <main className="w-full overflow-auto h-[calc(100%_-_80px)]">
        {/* empty toolbar to offset the content the height of the floating toolbar */}
        <div className="h-20 w-full" />
        <div className="h-[calc(100%_-_80px)] w-full">
          <Outlet />
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

          <NavLink
            to={`/baby/${profile.handle ?? profile.id}/`}
            end
            className={({ isActive }) =>
              cn(
                "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white hover:border-blue-200",
                {
                  "text-blue-500 border-blue-500 hover:text-blue-500 hover:border-blue-500":
                    isActive,
                }
              )
            }
          >
            <ControllerIcon className="text-7xl" />
          </NavLink>
          <Divider
            orientation="vertical"
            className="bg-slate h-8 opacity-50 mx-2"
          />
          <NavLink
            to={`/baby/${profile.handle ?? profile.id}/log`}
            className={({ isActive }) =>
              cn(
                "h-full flex items-center justify-center text-slate-200 hover:text-blue-200 border-b-2 border-white hover:border-blue-200",
                {
                  "text-blue-500 border-blue-500 hover:text-blue-500 hover:border-blue-500":
                    isActive,
                }
              )
            }
          >
            <ClockIcon className="text-4xl" />
          </NavLink>
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
            <Link
              to={`/baby/${profile.handle ?? profile.id}/search`}
              className="h-full"
            >
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <HistorySearchIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Search</ListItemText>
              </MenuItem>
            </Link>
            <Link
              to={`/baby/${profile.handle ?? profile.id}/trend`}
              className="h-full"
            >
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <AnalyticsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Trend</ListItemText>
              </MenuItem>
            </Link>
            <Divider className="my-2" />
            <Link to={`/baby`} className="h-full">
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <SwitchProfileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Switch Profile</ListItemText>
              </MenuItem>
            </Link>
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
