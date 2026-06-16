"use client";

import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * U.S. Open theming. Colors are sampled directly from the official
 * full-color logo asset (public/us-open-logo.png):
 *   navy  #093B60  ("OPEN")
 *   red   #D02030  ("US")
 *   silver #C7C8C8 (trophy)
 */

const usoNavy: MantineColorsTuple = [
  "#e7eef4",
  "#c9d8e6",
  "#a3bcd2",
  "#7c9fbd",
  "#5a86ac",
  "#3f72a0",
  "#2e6492",
  "#1d5080",
  "#0f436c",
  "#093b60", // brand navy
];

const usoRed: MantineColorsTuple = [
  "#fdeaec",
  "#f7ced2",
  "#eea0a7",
  "#e56f79",
  "#dd4653",
  "#d92d3c",
  "#d02030", // brand red
  "#b71a29",
  "#a31322",
  "#8d0a18",
];

const usoSilver: MantineColorsTuple = [
  "#f7f7f7",
  "#ededed",
  "#dfdfdf",
  "#d0d1d1",
  "#c7c8c8", // brand silver
  "#b3b4b4",
  "#9a9b9b",
  "#7f8080",
  "#666767",
  "#4d4e4e",
];

export const theme = createTheme({
  primaryColor: "usoNavy",
  primaryShade: { light: 8, dark: 6 },
  colors: {
    usoNavy,
    usoRed,
    usoSilver,
  },
  defaultRadius: "md",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontWeight: "800",
    fontFamily:
      '"Helvetica Neue", Helvetica, Arial, -apple-system, sans-serif',
  },
});
