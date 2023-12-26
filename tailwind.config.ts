import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        "2xs": "0.6rem",
        "3xs": "0.5rem",
        "4xs": "0.45rem",
      },
      width: {
        "22": "5.5rem",
      }
    },
  },
  plugins: [],
  // NOTE: this flag is used to make sure tailwind CSS overrides material UI styles
  // See https://mui.com/material-ui/guides/interoperability/#tailwind-css
  // See https://github.com/mui/material-ui/issues/29877#issuecomment-1003694632
  important: "#root",
} satisfies Config;
