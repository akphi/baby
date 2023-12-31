import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { BabyCareDataRegistry, BabyCareServerEvent } from "../data/BabyCare";

// NOTE: this is a fairly cheap but limitted way to prompt the client to refresh data
// the better but more involved way is to use websockets
// See https://sergiodxa.com/articles/use-server-sent-events-with-remix
// See https://github.com/remix-run/examples/tree/main/socket.io
export async function loader({ request }: LoaderFunctionArgs) {
  return eventStream(request.signal, function setup(send) {
    const eventEmitter = BabyCareDataRegistry.getEventEmitter();

    const handleProfileDataChange = (profileId: string) =>
      send({
        event: BabyCareServerEvent.PROFILE_DATA_CHANGE,
        data: `${Date.now()}:${profileId}`,
      });

    eventEmitter.on(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      handleProfileDataChange
    );

    return function clear() {
      eventEmitter.off(
        BabyCareServerEvent.PROFILE_DATA_CHANGE,
        handleProfileDataChange
      );
    };
  });
}
