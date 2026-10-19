// Loads Bryntum's CSS in the order it needs: icons, structure, light theme, then the dark
// override. Imported only by the client-only scheduler components.

import '@bryntum/scheduler/fontawesome/css/fontawesome.css';
import '@bryntum/scheduler/fontawesome/css/solid.css';
import '@bryntum/scheduler/scheduler.css';
import '@bryntum/scheduler/svalbard-light.css';
import './dark-theme.generated.css';
import './scheduler.css';
