export interface ServerInformation {
  onlineUsers: number;
  onlineDevices: number;
}

/** Second argument of a dynamic route handler: its (async) path params. */
export interface RouteContext<P extends Record<string, string>> {
  params: Promise<P>;
}
