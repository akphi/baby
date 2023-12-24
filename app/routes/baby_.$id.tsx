import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { BabyCareDataRegistry, BabyCareProfile } from "../data/baby-care";
import {
  guaranteeNonEmptyString,
  guaranteeNonNullable,
} from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";
import { HttpStatus } from "../shared/NetworkUtils";
import { Command, generateBabyCareEvent } from "./api.runCommand.$command";
import { BabyCareDashboard } from "./baby/BabyCareDashboard";
import { BabyCareEventViewer } from "./baby/BabyCareEventViewer";
import { parseISO } from "date-fns";

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
        <BabyCareEventViewer profile={profile} events={events} />
      </main>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case Command.BABY_CARE__BOTTLE_FEED:
    case Command.BABY_CARE__NURSING:
    case Command.BABY_CARE__PUMPING:
    case Command.BABY_CARE__DIAPER_CHANGE__POOP:
    case Command.BABY_CARE__DIAPER_CHANGE__PEE:
    case Command.BABY_CARE__SLEEP:
    case Command.BABY_CARE__PLAY:
    case Command.BABY_CARE__BATH: {
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
    default:
      return null;
  }
}
