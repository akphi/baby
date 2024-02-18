import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  BabyCareDataRegistry,
  BabyCareEventTimeSeriesStatsFrequency,
  type BabyCareEventStats,
  BabyCareEventTimeSeriesStatsRange,
} from "../data/BabyCare";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { parseISO, startOfDay, startOfYear, sub } from "date-fns";
import { BabyCareEventTrend } from "./baby/BabyCareEventTrend";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  return [{ title: `Trend: ${data.profile.nickname ?? data.profile.name}` }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
    guaranteeNonNullable(params.id)
  );

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("type");
  const frequency =
    searchParams.get("frequency") ??
    BabyCareEventTimeSeriesStatsFrequency.WEEKLY;
  const range = searchParams.get("range");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let stats: BabyCareEventStats;
  if (!eventType) {
    stats = { records: [] };
  } else {
    // startDate and endDate if present will take precedence over range
    if (range && !startDate && !endDate) {
      let _startDate: Date | undefined = undefined;
      switch (range.toLowerCase()) {
        case BabyCareEventTimeSeriesStatsRange.ONE_WEEK.toLowerCase(): {
          _startDate = sub(startOfDay(new Date()), { weeks: 1 });
          break;
        }
        case BabyCareEventTimeSeriesStatsRange.ONE_MONTH.toLowerCase(): {
          _startDate = sub(startOfDay(new Date()), { months: 1 });
          break;
        }
        case BabyCareEventTimeSeriesStatsRange.THREE_MONTH.toLowerCase(): {
          _startDate = sub(startOfDay(new Date()), { months: 3 });
          break;
        }
        case BabyCareEventTimeSeriesStatsRange.SIX_MONTH.toLowerCase(): {
          _startDate = sub(startOfDay(new Date()), { months: 6 });
          break;
        }
        case BabyCareEventTimeSeriesStatsRange.YTD.toLowerCase(): {
          _startDate = startOfYear(new Date());
          break;
        }
        case BabyCareEventTimeSeriesStatsRange.ONE_YEAR.toLowerCase(): {
          _startDate = sub(startOfDay(new Date()), { years: 1 });
          break;
        }
        default: {
          _startDate = undefined;
          break;
        }
      }
      stats = await BabyCareDataRegistry.getStats(
        profile,
        eventType,
        frequency,
        {
          startDate: _startDate,
          endDate: undefined,
        }
      );
    } else {
      stats = await BabyCareDataRegistry.getStats(
        profile,
        eventType,
        frequency,
        {
          startDate: startDate ? parseISO(startDate) : undefined,
          endDate: endDate ? parseISO(endDate) : undefined,
        }
      );
    }
  }

  return json({ profile, stats });
};

export default function BabyCareTrend() {
  const { profile, stats } = useLoaderData<typeof loader>();
  return <BabyCareEventTrend profile={profile} stats={stats} />;
}
