import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareProfile,
  Gender,
} from "../data/baby-care";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const entityManager = BabyCareDataRegistry.getEntityManager();
  (await entityManager).persistAndFlush(
    new BabyCareProfile("Chopchop", Gender.MALE, new Date())
  );
  return json({ success: true }, 200);
};
