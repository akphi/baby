import {
  Links,
  ScrollRestoration,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
} from "@remix-run/react";
import tailwind_styles from "./tailwind.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwind_styles },
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
      <body>
        <Outlet />
        <ScrollRestoration />

        <LiveReload />
        <Scripts />
      </body>
    </html>
  );
}
