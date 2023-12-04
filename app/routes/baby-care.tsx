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
import { AddCircleIcon } from "../shared/Icons";
import { Button } from "@mui/material";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  BabyCareProfileEditor,
  CREATE_PROFILE_SUBMIT_ACTION,
  UPDATE_PROFILE_SUBMIT_ACTION,
} from "./baby-care/BabyCareProfileEditor";
import { guaranteeNonEmptyString, isString } from "../shared/AssertionUtils";
import { parseNumber } from "../shared/CommonUtils";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profiles = await entityManager.getRepository(BabyCareProfile).findAll();
  return json({ profiles });
};

export default function BabyCare() {
  const { profiles } = useLoaderData<typeof loader>();
  const [showNewBabyForm, setShowNewBabyForm] = useState(false);

  return (
    <div className="h-full w-full bg-slate-50 flex justify-center items-center">
      <div className="flex w-96 py-16 px-10 bg-slate-100 rounded-xl shadow-md">
        {profiles.map((profile) => (
          <Button variant="outlined" key={profile.id} className="w-full h-10">
            New Baby
          </Button>
        ))}
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          className="w-full h-10"
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
      return redirect(`/baby-care/${profile.id}`);
    }
    case UPDATE_PROFILE_SUBMIT_ACTION:
    default:
      return; // TODO
  }
}
