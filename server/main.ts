import type { RegisterServerOptions } from "@peertube/peertube-types";

async function register({
  peertubeHelpers,
}: RegisterServerOptions): Promise<void> {
  await Promise.resolve();
  peertubeHelpers.logger.info("Hello world");
}

async function unregister(): Promise<void> {
  await Promise.resolve();
}

module.exports = {
  register,
  unregister,
};
