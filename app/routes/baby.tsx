import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type SerializeFrom,
  redirect,
  type MetaFunction,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  Gender,
  type BabyCareProfile,
} from "../data/BabyCare";
import {
  AddCircleIcon,
  FemaleIcon,
  MaleIcon,
  MoreVertIcon,
} from "../shared/Icons";
import { Button } from "@mui/material";
import { Link, useLoaderData, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";
import { BabyCareProfileEditor } from "./baby/BabyCareProfileEditor";
import { generateBabyAgeText } from "../data/BabyCareUtils";
import { useBabyCareProfileSyncPulse } from "./baby/BabyCareDataSync";

export const meta: MetaFunction = () => {
  return [{ title: "Home: Baby Care" }];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const profiles = await BabyCareDataRegistry.fetchProfiles();
  return json({ profiles });
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.CREATE_PROFILE:
    case BabyCareAction.UPDATE_PROFILE: {
      const { profile, created } =
        await BabyCareDataRegistry.createOrUpdateProfile(formData);
      if (!created) {
        return null;
      } else {
        return redirect(`/baby/${profile.handle ?? profile.id}`);
      }
    }
    case BabyCareAction.REMOVE_PROFILE: {
      await BabyCareDataRegistry.removeProfile(formData);
      return null;
    }
    default:
      return null;
  }
}

export default function BabyCareProfileManager() {
  const { profiles } = useLoaderData<typeof loader>();
  const [showCreateProfileForm, setShowCreateProfileForm] = useState(false);
  const [profileToEdit, setProfileToEdit] = useState<
    SerializeFrom<BabyCareProfile> | undefined
  >(undefined);
  const [syncPulseData, clearDataSyncPulse] = useBabyCareProfileSyncPulse();
  const revalidater = useRevalidator();

  useEffect(() => {
    if (syncPulseData && revalidater.state === "idle") {
      revalidater.revalidate();
      clearDataSyncPulse();
    }
  }, [syncPulseData, revalidater, clearDataSyncPulse]);

  return (
    <div className="h-full w-full flex justify-center items-center px-4">
      <div className="flex py-16 px-10 bg-white rounded-xl shadow-md flex-col">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex">
            <Link
              to={`/baby/${profile.handle ?? profile.id}`}
              className="w-full"
            >
              <Button
                variant="outlined"
                startIcon={
                  profile.genderAtBirth === Gender.MALE ? (
                    <MaleIcon />
                  ) : (
                    <FemaleIcon />
                  )
                }
                className="w-full h-10 my-1 flex items-center justify-between pr-0 pl-4 pt-0 pb-0"
              >
                <div className="h-full flex items-center">
                  <div className="text-sm">
                    {profile.nickname ?? profile.name}
                  </div>
                  <div className="flex items-center text-2xs font-semibold h-5 px-1.5 rounded bg-blue-500 bg-blend-darken ml-1.5 text-slate-50">
                    {generateBabyAgeText(profile.dob) + " old"}
                  </div>
                </div>
                <div
                  className="w-7 h-full flex items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    setProfileToEdit(profile);
                  }}
                >
                  <MoreVertIcon className="text-lg text-blue-300 hover:text-blue-500" />
                </div>
              </Button>
            </Link>
          </div>
        ))}
        {profileToEdit && (
          <BabyCareProfileEditor
            open={Boolean(profileToEdit)}
            onClose={() => setProfileToEdit(undefined)}
            profile={profileToEdit}
          />
        )}
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          className="w-full h-10 my-2"
          onClick={() => setShowCreateProfileForm(true)}
        >
          New Baby
        </Button>
        {showCreateProfileForm && (
          <BabyCareProfileEditor
            open={showCreateProfileForm}
            onClose={() => setShowCreateProfileForm(false)}
          />
        )}
      </div>
    </div>
  );
}
