import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareProfile,
  BottleFeedEvent,
  NursingEvent,
  PumpingEvent,
  DiaperChangeEvent,
  PlayEvent,
  BathEvent,
  SleepEvent,
} from "../data/baby-care";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { generateBabyCareEvent } from "./api.runCommand.$command";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";
import { BabyCareEventGrid } from "./baby/BabyCareEventGrid";
import { parseISO } from "date-fns";
import {
  extractOptionalNumber,
  extractOptionalString,
  extractRequiredBoolean,
  extractRequiredNumber,
  extractRequiredString,
} from "../shared/FormDataUtils";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const id = guaranteeNonNullable(params.id);
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profile = await entityManager.findOneOrFail(BabyCareProfile, {
    $or: [{ id }, { shortId: id }],
  });
  const events = await BabyCareDataRegistry.fetchEvents(
    profile,
    // NOTE: `date-fns` parseISO will return time in local timezone, which is what we pass in
    // if we use `new Date()` instead, it will be in UTC timezone and therefore, throw off the result
    date ? parseISO(date) : new Date()
  );

  return json({ profile, events });
};

export default function BabyCare() {
  const { profile, events } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-full w-full">
      <AppBar component="nav">
        <Toolbar>
          {/* <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            {/* <MenuIcon /> */}
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }}
          >
            Chopchop
          </Typography>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            {/* <Button key={item} sx={{ color: "#fff" }}>
                {item}
              </Button> */}
            {/* {navItems.map((item) => (
            ))} */}
          </Box>
        </Toolbar>
      </AppBar>
      <main className="w-full overflow-auto">
        {/* empty toolbar to offset the content the height of the floating toolbar */}
        <Toolbar />
        <BabyCareDashboard profile={profile} />
        <BabyCareEventGrid profile={profile} events={events} />
      </main>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("__action");

  switch (action) {
    case BabyCareAction.CREATE_BOTTLE_FEED_EVENT:
    case BabyCareAction.CREATE_NURSING_EVENT:
    case BabyCareAction.CREATE_PUMPING_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT:
    case BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT:
    case BabyCareAction.CREATE_SLEEP_EVENT:
    case BabyCareAction.CREATE_BATH_EVENT:
    case BabyCareAction.CREATE_PLAY_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");

      let profile: BabyCareProfile;
      try {
        profile = await entityManager.findOneOrFail(BabyCareProfile, {
          $or: [{ id }, { shortId: id }],
        });
      } catch {
        return json(
          { error: `Baby care profile (id/shortId = ${id}) not found` },
          HttpStatus.NOT_FOUND
        );
      }

      const event = generateBabyCareEvent(action, profile);
      if (!event) {
        return json(
          { error: `Unsupported event generation for command '${action}'` },
          HttpStatus.NOT_IMPLEMENTED
        );
      }

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(BottleFeedEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.volume = extractRequiredNumber(formData, "volume");
      event.formulaMilkVolume = extractOptionalNumber(
        formData,
        "formulaMilkVolume"
      );

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_PUMPING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(PumpingEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.volume = extractRequiredNumber(formData, "volume");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_NURSING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(NursingEvent, { id });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.leftDuration = extractRequiredNumber(formData, "leftDuration");
      event.rightDuration = extractRequiredNumber(formData, "rightDuration");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const event = await entityManager.findOneOrFail(DiaperChangeEvent, {
        id,
      });

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");
      event.poop = extractRequiredBoolean(formData, "poop");
      event.pee = extractRequiredBoolean(formData, "pee");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_SLEEP_EVENT:
    case BabyCareAction.UPDATE_BATH_EVENT:
    case BabyCareAction.UPDATE_PLAY_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const clazz =
        action === BabyCareAction.UPDATE_PLAY_EVENT
          ? PlayEvent
          : action === BabyCareAction.UPDATE_BATH_EVENT
          ? BathEvent
          : action === BabyCareAction.UPDATE_SLEEP_EVENT
          ? SleepEvent
          : undefined;
      const event = await entityManager.findOneOrFail(
        guaranteeNonNullable(clazz),
        { id }
      );

      event.time = new Date(extractRequiredString(formData, "time"));
      event.comment = extractOptionalString(formData, "comment")?.trim();
      event.duration = extractOptionalNumber(formData, "duration");

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.REMOVE_BOTTLE_FEED_EVENT:
    case BabyCareAction.REMOVE_PUMPING_EVENT:
    case BabyCareAction.REMOVE_NURSING_EVENT:
    case BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT:
    case BabyCareAction.REMOVE_PLAY_EVENT:
    case BabyCareAction.REMOVE_BATH_EVENT:
    case BabyCareAction.REMOVE_SLEEP_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = extractRequiredString(formData, "id");
      const clazz =
        action === BabyCareAction.REMOVE_BOTTLE_FEED_EVENT
          ? BottleFeedEvent
          : action === BabyCareAction.REMOVE_PUMPING_EVENT
          ? PumpingEvent
          : action === BabyCareAction.REMOVE_NURSING_EVENT
          ? NursingEvent
          : action === BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT
          ? DiaperChangeEvent
          : action === BabyCareAction.REMOVE_PLAY_EVENT
          ? PlayEvent
          : action === BabyCareAction.REMOVE_BATH_EVENT
          ? BathEvent
          : action === BabyCareAction.REMOVE_SLEEP_EVENT
          ? SleepEvent
          : undefined;
      await entityManager.nativeDelete(guaranteeNonNullable(clazz), { id });
      await entityManager.flush();
      return json({ id }, HttpStatus.OK);
    }
    default:
      return null;
  }
}
