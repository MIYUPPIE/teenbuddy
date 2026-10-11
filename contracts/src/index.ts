/**
 * @teenbuddy/contracts - the only module every service is allowed to share.
 *
 * Nothing here reaches into a service. Nothing here performs IO. Changing a
 * shape in this package is a coordinated change across both sides of a
 * boundary: bump SCHEMA_VERSION and update every consumer in the same commit.
 */
export * from "./validate.ts";
export * from "./enums.ts";
export * from "./records.ts";
