/** @type {import('@remix-run/dev').AppConfig} */
export default {
  // See https://remix.run/docs/en/main/guides/gotchas#importing-esm-packages
  serverDependenciesToBundle: [/@mui\//, /date-fns/],
};
