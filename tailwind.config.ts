import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
  // NOTE: to make material ui + tailwind + remix to work properly together, consider following this example
  // See https://github.com/mui/material-ui/tree/master/examples/material-ui-remix-ts
} satisfies Config;
