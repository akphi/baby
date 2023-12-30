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
  BabyCareProfile,
  Gender,
} from "../data/baby-care";
import {
  AddCircleIcon,
  FemaleIcon,
  MaleIcon,
  MoreVertIcon,
} from "../shared/Icons";
import { Button } from "@mui/material";
import { Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { BabyCareProfileEditor } from "./baby/BabyCareProfileEditor";
import { guaranteeNonEmptyString } from "../shared/AssertionUtils";
import {
  extractOptionalString,
  extractRequiredNumber,
  extractRequiredString,
} from "../shared/FormDataUtils";
import { generateBabyAgeText } from "./baby/BabyCareUtils";

export const meta: MetaFunction = () => {
  return [{ title: "Home: Baby Care" }];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profiles = await entityManager.getRepository(BabyCareProfile).findAll();
  return json({ profiles });
};

export default function BabyCareProfileManager() {
  const { profiles } = useLoaderData<typeof loader>();
  const [showCreateProfileForm, setShowCreateProfileForm] = useState(false);
  const [profileToEdit, setProfileToEdit] = useState<
    SerializeFrom<BabyCareProfile> | undefined
  >(undefined);

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
                className="w-full h-10 my-1 flex items-center justify-between pr-0 pl-4"
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

export async function action({ request }: ActionFunctionArgs) {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.CREATE_PROFILE:
    case BabyCareAction.UPDATE_PROFILE: {
      const id = formData.get("id");

      let profile: BabyCareProfile;

      const name = extractRequiredString(formData, "name");
      const dob = new Date(extractRequiredString(formData, "dob"));
      const gender =
        Gender[extractRequiredString(formData, "gender") as Gender];

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

      profile.nickname = extractOptionalString(formData, "nickname")?.trim();
      profile.handle = extractOptionalString(formData, "handle")?.trim();

      profile.defaultFeedingVolume = extractRequiredNumber(
        formData,
        "defaultFeedingVolume"
      );
      profile.defaultFeedingInterval = extractRequiredNumber(
        formData,
        "defaultFeedingInterval"
      );
      profile.defaultNightFeedingInterval = extractRequiredNumber(
        formData,
        "defaultNightFeedingInterval"
      );

      profile.defaultPumpingDuration = extractRequiredNumber(
        formData,
        "defaultPumpingDuration"
      );
      profile.defaultPumpingInterval = extractRequiredNumber(
        formData,
        "defaultPumpingInterval"
      );
      profile.defaultNightPumpingInterval = extractRequiredNumber(
        formData,
        "defaultNightPumpingInterval"
      );

      profile.babyDaytimeStart = extractRequiredNumber(
        formData,
        "babyDaytimeStart"
      );
      profile.babyDaytimeEnd = extractRequiredNumber(
        formData,
        "babyDaytimeEnd"
      );
      profile.parentDaytimeStart = extractRequiredNumber(
        formData,
        "parentDaytimeStart"
      );
      profile.parentDaytimeEnd = extractRequiredNumber(
        formData,
        "parentDaytimeEnd"
      );

      await entityManager.persistAndFlush(profile);

      if (id) {
        return null;
      } else {
        return redirect(`/baby/${profile.handle ?? profile.id}`);
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
