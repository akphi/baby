import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { BabyCareDataRegistry } from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { BabyCareEventCalendar } from "./baby/BabyCareEventCalendar";
import { parse, startOfMonth } from "date-fns";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Calendar: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );

  const { searchParams } = new URL(request.url);
  const month = searchParams.has("month")
    ? parse(searchParams.get("month") ?? "", "MM-yyyy", new Date())
    : startOfMonth(new Date());
  const events = await BabyCareDataRegistry.getCalendarEvents(profile, month);

  return json({ profile, events });
};

export default function BabyCareCalendar() {
  const { profile, events } = useLoaderData<typeof loader>();
  return <BabyCareEventCalendar profile={profile} events={events} />;
}
