import { soxa } from "../../deps.ts";
import {
  EServiceKindError,
  GithubError,
  QueryDefaultResponse,
  ServiceError,
} from "../Types/index.ts";

function isUnauthorizedMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("bad credentials") ||
    m.includes("requires authentication") ||
    m.includes("you must be logged in") ||
    m.includes("authentication") && m.includes("failed");
}

export async function requestGithubData<T = unknown>(
  query: string,
  variables: { [key: string]: string },
  token = "",
) {
  const response = await soxa.post("", {}, {
    data: { query, variables },
    headers: {
      Authorization: `bearer ${token}`,
    },
  }) as QueryDefaultResponse<{ user: T }>;
  const responseData = response.data;

  if (responseData?.data?.user) {
    return responseData.data.user;
  }

  throw handleError(responseData);
}

function handleError(
  responseData: {
    data?: unknown;
    errors?: GithubError[];
    message?: string;
    documentation_url?: string;
  },
): ServiceError {
  let isRateLimitExceeded = false;
  let isUnauthorized = false;
  const arrayErrors = responseData?.errors || [];

  if (Array.isArray(arrayErrors) && arrayErrors.length > 0) {
    isRateLimitExceeded = arrayErrors.some((error) =>
      error.type.includes(EServiceKindError.RATE_LIMIT)
    );
    isUnauthorized = arrayErrors.some((error) =>
      typeof error.message === "string" && isUnauthorizedMessage(error.message)
    );
  }

  if (responseData?.message) {
    isRateLimitExceeded = responseData.message.toLowerCase().includes(
      "rate limit",
    );
    isUnauthorized = isUnauthorized ||
      isUnauthorizedMessage(responseData.message);
  }

  if (isRateLimitExceeded) {
    throw new ServiceError(
      "Rate limit exceeded",
      EServiceKindError.RATE_LIMIT,
    );
  }

  if (isUnauthorized) {
    throw new ServiceError(
      "Unauthorized",
      EServiceKindError.UNAUTHORIZED,
    );
  }

  throw new ServiceError(
    "unknown error",
    EServiceKindError.NOT_FOUND,
  );
}
