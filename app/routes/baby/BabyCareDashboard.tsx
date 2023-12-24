import type { SerializeFrom } from "@remix-run/node";
import type { BabyCareProfile } from "../../data/baby-care";
import { useFetcher } from "@remix-run/react";
import {
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChildToyIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  SleepIcon,
} from "../../shared/Icons";
import { IconButton } from "@mui/material";
import { Command } from "../api.runCommand.$command";
import { HttpMethod } from "../../shared/NetworkUtils";

export const BabyCareDashboard = (props: {
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { profile } = props;
  const fetcher = useFetcher();

  return (
    <div className="flex justify-center items-center w-full p-6 bg-slate-50">
      <div className="flex flex-col justify-center items-center p-6 bg-white rounded-xl shadow-md w-fit">
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__BOTTLE_FEED,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BottleIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__NURSING,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <NursingIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl  text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__PUMPING,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BreastPumpIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-purple-100 border-purple-500 text-5xl  text-black" />
          </IconButton>
        </div>
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__DIAPER_CHANGE__POOP,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <PoopIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-amber-100 border-amber-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__DIAPER_CHANGE__PEE,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <PeeIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-amber-100 border-amber-500 text-5xl  text-black" />
          </IconButton>
          <IconButton className="w-24 h-24 invisible" />
        </div>
        <div className="flex justify-center items-center">
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__PLAY,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <ChildToyIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__BATH,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <BathIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl  text-black" />
          </IconButton>
          <IconButton
            className="w-24 h-24"
            onClick={() =>
              fetcher.submit(
                {
                  action: Command.BABY_CARE__SLEEP,
                  id: profile.id,
                },
                { method: HttpMethod.POST }
              )
            }
          >
            <SleepIcon className="w-20 h-20 flex justify-center items-center rounded-full border-2 bg-lime-100 border-lime-500 text-5xl  text-black" />
          </IconButton>
          {/* <ClickAwayListener onClickAway={(event) => onClickAway(event)}>
        <MuiDialog
          hideBackdrop={true}
          disableEscapeKeyDown={false}
          classes={{
            ...classes,
            root: clsx(['mui-non-blocking-dialog__root', classes?.root ?? '']),
            paper: clsx([
              'mui-non-blocking-dialog__paper',
              classes?.paper ?? '',
            ]),
          }}
          {...dialogProps}
        />
      </ClickAwayListener> */}
        </div>
      </div>
    </div>
  );
};
