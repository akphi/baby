import {
  json,
  type LoaderFunction,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { BabyCareDataRegistry, BabyCareProfile } from "../data/baby-care";

enum FormType {
  UpdateName = "UpdateName",
  UpdateAvatar = "UpdateAvatar",
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profiles = await entityManager.getRepository(BabyCareProfile).findAll();
  return json({ profiles });
};

export default function BabyCare() {
  // const { profiles } = useLoaderData<typeof loader>();

  // console.log(profiles);

  return <div>asdasd</div>;

  // <>
  //   <form method="post">
  //     <input name="name" />
  //     <input name="type" type="hidden" value={FormType.UpdateName} />
  //     <button type="submit">Save</button>
  //   </form>

  //   <form method="post">
  //     <input name="avatar" />
  //     <input name="type" type="hidden" value={FormType.UpdateAvatar} />
  //     <button type="submit">Save</button>
  //   </form>
  // </>
}
