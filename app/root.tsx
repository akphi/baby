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

export const links: LinksFunction = () => [
  {
    rel: "icon",
    href: "/favicon.ico",
    type: "image/png",
  },
  {
    rel: "apple-touch-icon",
    href: "/apple-touch-icon.png",
    type: "image/png",
    sizes: "180x180",
  },
  {
    rel: "icon",
    href: "/favicon-32x32.png",
    type: "image/png",
    sizes: "32x32",
  },
  {
    rel: "icon",
    href: "/favicon-16x16.png",
    type: "image/png",
    sizes: "16x16",
  },
  {
    rel: "manifest",
    href: "/site.webmanifest",
    type: "application/json",
  },
  { rel: "stylesheet", href: styles },
];

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
