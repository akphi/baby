import {
  Links,
  ScrollRestoration,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
} from "@remix-run/react";
import styles from "./style.css";
import type { LinksFunction } from "@remix-run/node";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function Root() {
  return (
    <html>
      <head>
        <link rel="icon" href="data:image/x-icon;base64,AA" />
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <Meta />
        <Links />
      </head>
      <body id="root">
        <div className="h-screen w-screen overflow-hidden">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Outlet />
          </LocalizationProvider>
        </div>
        <ScrollRestoration />

        <LiveReload />
        <Scripts />
      </body>
    </html>
  );
}
