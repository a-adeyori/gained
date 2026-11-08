// Loads Bryntum's CSS in the order it needs: icons, structure, then the theme. The Svalbard theme
// follows the page's color-scheme, so it switches with Gained's light and dark modes on its own.
// Imported only by the client-only scheduler components.

import '@bryntum/core-enterprise/fontawesome/css/fontawesome.css';
import '@bryntum/core-enterprise/fontawesome/css/solid.css';
import '@bryntum/scheduler-enterprise/scheduler.css';
import '@bryntum/scheduler-enterprise/svalbard.css';
import './scheduler.css';
