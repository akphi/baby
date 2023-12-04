import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareProfile,
  PoopEvent,
} from "../data/baby-care";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log(request);
  // const entityManager = await BabyCareDataRegistry.getEntityManager();
  // await entityManager.persistAndFlush(
  //   new PoopEvent(new Date(), new BabyCareProfile("test", new Date()))
  // );
  return json({ success: true }, 200);
};
