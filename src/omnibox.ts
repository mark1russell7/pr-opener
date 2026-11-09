// The text of the omnibox rows. Chrome reads each description as XML, so each value in it is escaped.

/** This function escapes a value for the XML of an omnibox description: `&`, `<`, `>`, `"` and `'`. */
export function xmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

/** This function gives the PR number of the typed text, or null when the text is not a number of 1 to 9 digits. */
export function prNumberOf(text: string): string | null {
  const trimmed = text.trim();
  return /^\d{1,9}$/.test(trimmed) ? trimmed : null;
}

/** The description of the first row before the user types a number. */
export const START_TEXT = "Enter PR number (e.g., 123)";

/** The description of the first row when the text is not a PR number. */
export const NOT_A_NUMBER_TEXT = "A PR number has only digits (e.g., 123)";

/** The description of the first row when the list of repos is empty. */
export const NO_REPO_TEXT = "No repo yet: add one in the options of PR Opener";
