/* AM I IN THE APP RATHER THAN A TAB?
 *
 * The App Store build is these same pages in a WKWebView, loaded from the same
 * server — so every page runs unchanged and there is no build flag, no second
 * copy of anything, and nothing to keep in step. The one thing the pages have
 * to be able to ask is which of the two they are in, because a handful of
 * browser facts are different there and every one of them is a wrong screen:
 *
 *   install.js  — "Add to Home Screen" shown to somebody already holding the
 *                 app. A WKWebView answers display-mode: browser and leaves
 *                 navigator.standalone undefined, so the installed() check
 *                 says no, and the instruction it then prints cannot be
 *                 followed: there is no share sheet in an app.
 *   notify.js   — a WKWebView has no Push API at all, so the switch would be
 *                 hidden and the app would ship without the one feature that
 *                 makes it worth being an app. It asks Apple instead.
 *
 * ONE DEFINITION, IMPORTED TWICE. Written out in both files it would drift,
 * and the copy that drifted would be the one nobody watches happen — the app
 * is the build the person writing this cannot open.
 *
 * Capacitor puts this object on window before any of the page's own scripts
 * run. In a browser it is simply not there, which is the false case and the
 * one nearly everybody is in.
 */
export const NATIVE = (() => {
  try { return Boolean(window.Capacitor?.isNativePlatform?.()); } catch (e) { return false; }
})();

/** Apple's end of the notification, or null anywhere else. A function and not
 *  a constant: the plugin is registered by the native half during startup and
 *  may not be on window at the moment this module is first imported. */
export const bell = () => {
  try { return window.Capacitor?.Plugins?.PushNotifications || null; } catch (e) { return null; }
};
