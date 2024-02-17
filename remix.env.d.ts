/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

// For chart.js custom plugin
import type { ChartType } from "chart.js";

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    hoverLine?: {};
  }

  interface Chart {
    hoverLine?: {
      display?: boolean;
    };
  }
}
