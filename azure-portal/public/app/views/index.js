// Page renderers by nav item id. Each is async (main, context) and replaces main's content.
import {renderHome} from './home.js';
import {renderPending} from './pending.js';
import {renderAdmin} from './admin.js';

export const VIEWS = {
  home: renderHome,
  admin: renderAdmin,
  pending: renderPending
};
