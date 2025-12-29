import { EServiceKindError, ServiceError } from "../Types/index.ts";
import { Error400, Error401, Error404, Error419 } from "../error_page.ts";

interface ErrorPageProps {
  error: ServiceError;
  contextHtml?: string;
}

export function ErrorPage({ error, contextHtml }: ErrorPageProps) {
  let cause: Error400 | Error401 | Error404 | Error419 = new Error400();

  if (error.cause === EServiceKindError.RATE_LIMIT) {
    cause = new Error419();
  }

  if (error.cause === EServiceKindError.UNAUTHORIZED) {
    cause = new Error401(
      'GitHub API authorization failed. Set a valid "GITHUB_TOKEN1" environment variable on your deployment.',
    );
  }

  if (error.cause === EServiceKindError.NOT_FOUND) {
    cause = new Error404(
      `Sorry, the user you are looking for was not found.${contextHtml ? `<br/><br/>${contextHtml}` : ""}`,
    );
  }

  return cause;
}
