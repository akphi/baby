import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareProfile,
  Gender,
} from "../data/baby-care";
import {
  AddCircleIcon,
  FemaleIcon,
  MaleIcon,
  RemoveCircleIcon,
} from "../shared/Icons";
import { Button, IconButton } from "@mui/material";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  BabyCareProfileEditor,
  CREATE_PROFILE_SUBMIT_ACTION,
  UPDATE_PROFILE_SUBMIT_ACTION,
} from "./baby-care/BabyCareProfileEditor";
import { guaranteeNonEmptyString, isString } from "../shared/AssertionUtils";
import { parseNumber } from "../shared/CommonUtils";
import { formatDistance } from "date-fns";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profiles = await entityManager.getRepository(BabyCareProfile).findAll();
  return json({ profiles });
};

export default function BabyCare() {
  const { profiles } = useLoaderData<typeof loader>();
  const [showNewBabyForm, setShowNewBabyForm] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-full w-full bg-slate-50 flex justify-center items-center">
      <div className="flex w-96 py-16 px-10 bg-slate-100 rounded-xl shadow-md flex-col">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex">
            <Button
              variant="outlined"
              startIcon={
                profile.genderAtBirth === Gender.MALE ? (
                  <MaleIcon />
                ) : (
                  <FemaleIcon />
                )
              }
              onClick={() => navigate(`/baby/${profile.shortId ?? profile.id}`)}
              className="w-full h-10 my-1 flex items-center"
            >
              <div>{profile.nickname ?? profile.name}</div>
              <div className="text-2xs font-semibold h-4 px-1 rounded-sm bg-blue-500 bg-blend-darken ml-2 text-slate-50">
                {formatDistance(new Date(), new Date(profile.dob), {}) + " old"}
              </div>
            </Button>
            <IconButton color="error" className="w-12 h-12 pl-2">
              <RemoveCircleIcon />
            </IconButton>
          </div>
        ))}
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          className="w-full h-10 my-2"
          onClick={() => setShowNewBabyForm(true)}
        >
          New Baby
        </Button>
        {showNewBabyForm && (
          <BabyCareProfileEditor
            open={showNewBabyForm}
            onClose={() => setShowNewBabyForm(false)}
          />
        )}
      </div>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case CREATE_PROFILE_SUBMIT_ACTION: {
      const name = guaranteeNonEmptyString(
        formData.get("name"),
        "Name is required"
      );
      const dob = new Date(formData.get("dob") as string);
      const gender = Gender[formData.get("gender") as Gender];

      const profile = new BabyCareProfile(name, gender, dob);

      if (formData.has("nickname") && isString(formData.get("nickname"))) {
        profile.nickname = formData.get("nickname") as string;
      }
      if (formData.has("shortId") && isString(formData.get("shortId"))) {
        profile.shortId = formData.get("shortId") as string;
      }
      if (
        formData.has("defaultFeedingVolume") &&
        isString(formData.get("defaultFeedingVolume"))
      ) {
        profile.defaultFeedingVolume = parseNumber(
          formData.get("defaultFeedingVolume") as string
        );
      }

      await entityManager.persistAndFlush(profile);
      return redirect(`/baby/${profile.shortId ?? profile.id}`);
    }
    case UPDATE_PROFILE_SUBMIT_ACTION:
    default:
      return; // TODO
  }
}
