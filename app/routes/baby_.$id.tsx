import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  type BabyCareEvent,
  BabyCareAction,
  BabyCareDataRegistry,
  BabyCareProfile,
  BottleFeedEvent,
  NursingEvent,
  PumpingEvent,
} from "../data/baby-care";
import {
  guaranteeNonEmptyString,
  guaranteeNonNullable,
  isString,
} from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { generateBabyCareEvent } from "./api.runCommand.$command";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";
import { BabyCareEventGrid } from "./baby/BabyCareEventGrid";
import { parseISO } from "date-fns";
import {
  parseNumber,
  parseNumberSafe,
  returnUndefOnError,
} from "../shared/CommonUtils";

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

const updateBasicEventAttribute = (
  formData: FormData,
  event: BabyCareEvent
) => {
  event.time = new Date(formData.get("time") as string);
  if (formData.has("comment") && isString(formData.get("comment"))) {
    event.comment = formData.get("comment") as string;
  }
  if (formData.has("duration") && isString(formData.get("duration"))) {
    event.duration = returnUndefOnError(() =>
      parseNumber(formData.get("duration") as string)
    );
  }
};

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
      const id = guaranteeNonEmptyString(
        formData.get("id"),
        "'id is missing or empty"
      ).trim();

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
      const id = guaranteeNonEmptyString(
        formData.get("id"),
        "'id is missing or empty"
      ).trim();
      const event = await entityManager.findOneOrFail(BottleFeedEvent, { id });
      updateBasicEventAttribute(formData, event);

      if (formData.has("volume") && isString(formData.get("volume"))) {
        event.volume = parseNumberSafe(formData.get("volume") as string);
      }
      if (
        formData.has("formulaMilkVolume") &&
        isString(formData.get("formulaMilkVolume"))
      ) {
        event.formulaMilkVolume = returnUndefOnError(() =>
          parseNumber(formData.get("formulaMilkVolume") as string)
        );
      }

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_PUMPING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = guaranteeNonEmptyString(
        formData.get("id"),
        "'id is missing or empty"
      ).trim();
      const event = await entityManager.findOneOrFail(PumpingEvent, { id });
      updateBasicEventAttribute(formData, event);

      if (formData.has("volume") && isString(formData.get("volume"))) {
        event.volume = parseNumberSafe(formData.get("volume") as string);
      }

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_NURSING_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = guaranteeNonEmptyString(
        formData.get("id"),
        "'id is missing or empty"
      ).trim();
      const event = await entityManager.findOneOrFail(NursingEvent, { id });
      updateBasicEventAttribute(formData, event);

      if (
        formData.has("leftDuration") &&
        isString(formData.get("leftDuration"))
      ) {
        event.leftDuration = parseNumberSafe(
          formData.get("leftDuration") as string
        );
      }
      if (
        formData.has("rightDuration") &&
        isString(formData.get("rightDuration"))
      ) {
        event.rightDuration = parseNumberSafe(
          formData.get("rightDuration") as string
        );
      }

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT: // TODO
    case BabyCareAction.UPDATE_SLEEP_EVENT:
    case BabyCareAction.UPDATE_BATH_EVENT:
    case BabyCareAction.UPDATE_PLAY_EVENT: {
      const entityManager = await BabyCareDataRegistry.getEntityManager();
      const id = guaranteeNonEmptyString(
        formData.get("id"),
        "'id is missing or empty"
      ).trim();
      const event = await entityManager.findOneOrFail(BottleFeedEvent, { id });
      updateBasicEventAttribute(formData, event);

      entityManager.persistAndFlush(event);
      return json({ event }, HttpStatus.OK);
    }
    default:
      return null;
  }
}
