"use strict";
// Discard obsolete capability keys without starting any Firebase session or request.
if (location.search || location.hash) history.replaceState(null, "", location.pathname);
