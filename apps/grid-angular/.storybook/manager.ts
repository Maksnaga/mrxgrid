// .storybook/manager.js
import { addons } from "storybook/manager-api";
addons.setConfig({
  sidebar: {
    // Top-level groups (here: "Documentation" and "Stories") are rendered
    // as collapsible roots instead of always-open headers — this matches
    // the requested "all stories grouped in one collapse" behaviour.
    showRoots: true,
  },
});
