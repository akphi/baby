/** @type {import('@remix-run/dev').AppConfig} */
export default {
  // NOTE: We're stuck with older version of material-ui since it does not support ESM and newer version
  // contains changes that could break the app while running
  // The recommended workaround is to set serverModuleFormat: 'cjs', but it would cause problems with other
  // ESM modules we use
  // See https://github.com/mui/material-ui/issues/30671
  // See https://remix.run/docs/en/main/guides/gotchas#importing-esm-packages
  // See https://github.com/mui/material-ui/blob/master/examples/material-ui-remix-ts/remix.config.js
  serverDependenciesToBundle: [/@mui\//],
};
