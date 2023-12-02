import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { BabyCareDataRegistry, BabyCareProfile } from "../data/baby-care";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const a = await entityManager.getRepository(BabyCareProfile).findAll();
  console.log(a);
  return json({ success: true }, 200);
};
