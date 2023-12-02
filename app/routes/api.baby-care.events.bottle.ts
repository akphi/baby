import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { BabyCareDataRegistry, BabyCareProfile } from "../data/baby-care";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const entityManager = BabyCareDataRegistry.getEntityManager();
  (await entityManager).persistAndFlush(new BabyCareProfile("Chopchop", new Date()));
  return json({ success: true }, 200);
};
