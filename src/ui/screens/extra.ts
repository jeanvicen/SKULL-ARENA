import type { App } from '../app';
import { eventsScreen } from './events';
import { creditsScreen, settingsScreen } from './settings';
import { chestsScreen, shopScreen } from './shop';
import { socialScreen } from './social';

export function registerExtraScreens(app: App): void {
  app.register('shop', (a) => shopScreen(a));
  app.register('chests', (a) => chestsScreen(a));
  app.register('events', (a, p) => eventsScreen(a, p));
  app.register('social', (a) => socialScreen(a));
  app.register('settings', (a) => settingsScreen(a));
  app.register('credits', (a) => creditsScreen(a));
}
