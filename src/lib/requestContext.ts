import { AsyncLocalStorage } from "node:async_hooks";

export type RequestStore = { requestId: string };

export const requestContext = new AsyncLocalStorage<RequestStore>();
