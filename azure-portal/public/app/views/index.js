// Page renderers by nav item id. Each is async (main, context) and replaces main's content.
import {renderHome} from './home.js';
import {renderPending} from './pending.js';

export const VIEWS = {
  home: renderHome,
  pending: renderPending
};
