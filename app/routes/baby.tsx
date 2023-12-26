import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareProfile,
  Gender,
} from "../data/baby-care";
import {
  AddCircleIcon,
  EditIcon,
  FemaleIcon,
  MaleIcon,
  RemoveCircleIcon,
} from "../shared/Icons";
import { Button, IconButton } from "@mui/material";
import { Link, useLoaderData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { BabyCareProfileEditor } from "./baby/BabyCareProfileEditor";
import { guaranteeNonEmptyString, isString } from "../shared/AssertionUtils";
import { parseNumber, returnUndefOnError } from "../shared/CommonUtils";
import { formatDistanceStrict } from "date-fns";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { HttpMethod } from "../shared/NetworkUtils";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profiles = await entityManager.getRepository(BabyCareProfile).findAll();
  return json({ profiles });
};

export default function BabyCareProfileManager() {
  const { profiles } = useLoaderData<typeof loader>();
  const [showCreateProfileForm, setShowCreateProfileForm] = useState(false);
  const [showEditProfileForm, setShowEditProfileForm] = useState(false);
  const [profileIdToRemove, setProfileIdToRemove] = useState<
    string | undefined
  >(undefined);
  const submit = useSubmit();

  return (
    <div className="h-full w-full flex justify-center items-center px-4 bg-slate-50">
      <div className="flex py-16 px-10 bg-white rounded-xl shadow-md flex-col">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex">
            <Link
              to={`/baby/${profile.shortId ?? profile.id}`}
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
                className="w-full h-10 my-1 flex items-center"
              >
                <div>{profile.nickname ?? profile.name}</div>
                <div className="text-2xs font-semibold h-4 px-1 rounded-sm bg-blue-500 bg-blend-darken ml-2 text-slate-50">
                  {formatDistanceStrict(new Date(), new Date(profile.dob)) +
                    " old"}
                </div>
              </Button>
            </Link>

            <div className="flex justify-center items-center ml-2">
              <IconButton
                color="primary"
                className="w-8 h-8 pl-2"
                onClick={() => setShowEditProfileForm(true)}
              >
                <EditIcon fontSize="medium" />
              </IconButton>
              <IconButton
                color="error"
                className="w-8 h-8 pl-2"
                onClick={() => setProfileIdToRemove(profile.id)}
              >
                <RemoveCircleIcon fontSize="medium" />
              </IconButton>
            </div>
            {showEditProfileForm && (
              <BabyCareProfileEditor
                open={showEditProfileForm}
                onClose={() => setShowEditProfileForm(false)}
                profile={profile}
              />
            )}
          </div>
        ))}
        {profileIdToRemove && (
          <ConfirmationDialog
            open={profileIdToRemove !== undefined}
            onClose={() => setProfileIdToRemove(undefined)}
            message="All logs and data associated with this profile will be permanently removed. Do you want to proceed?"
            action={() => {
              const data = new FormData();
              data.set("id", profileIdToRemove);
              data.set("action", BabyCareAction.REMOVE_PROFILE);
              submit(data, { method: HttpMethod.POST });
            }}
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

export async function action({ request }: ActionFunctionArgs) {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.CREATE_PROFILE:
    case BabyCareAction.UPDATE_PROFILE: {
      const id = formData.get("id");

      let profile: BabyCareProfile;

      const name = guaranteeNonEmptyString(
        formData.get("name"),
        "Name is required"
      );
      const dob = new Date(formData.get("dob") as string);
      const gender = Gender[formData.get("gender") as Gender];

      if (id) {
        profile = await entityManager.findOneOrFail(BabyCareProfile, {
          id: id as string,
        });
        profile.name = name;
        profile.dob = dob;
        profile.genderAtBirth = gender;
      } else {
        profile = new BabyCareProfile(name, gender, dob);
      }

      if (formData.has("nickname") && isString(formData.get("nickname"))) {
        const nickname = (formData.get("nickname") as string).trim();
        profile.nickname = nickname ? nickname : undefined;
      }
      if (formData.has("shortId") && isString(formData.get("shortId"))) {
        const shortId = (formData.get("shortId") as string).trim();
        profile.shortId = shortId ? shortId : undefined;
      }
      if (
        formData.has("defaultFeedingVolume") &&
        isString(formData.get("defaultFeedingVolume"))
      ) {
        profile.defaultFeedingVolume = returnUndefOnError(() =>
          parseNumber(formData.get("defaultFeedingVolume") as string)
        );
      }
      if (
        formData.has("defaultPumpingDuration") &&
        isString(formData.get("defaultPumpingDuration"))
      ) {
        profile.defaultPumpingDuration = returnUndefOnError(() =>
          parseNumber(formData.get("defaultPumpingDuration") as string)
        );
      }
      if (
        formData.has("feedingInterval") &&
        isString(formData.get("feedingInterval"))
      ) {
        profile.feedingInterval = returnUndefOnError(() =>
          parseNumber(formData.get("feedingInterval") as string)
        );
      }

      await entityManager.persistAndFlush(profile);

      if (id) {
        return null;
      } else {
        return redirect(`/baby/${profile.shortId ?? profile.id}`);
      }
    }
    case BabyCareAction.REMOVE_PROFILE: {
      const profile = await entityManager.findOneOrFail(BabyCareProfile, {
        id: guaranteeNonEmptyString(formData.get("id")),
      });
      await entityManager.removeAndFlush(profile);
      return null;
    }
    default:
      return null;
  }
}
