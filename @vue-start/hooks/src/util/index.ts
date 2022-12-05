export * from "./options";
export * from "./tree";
export * from "./format";
export * from "./number";
export * from "./pattern";

/**
 * 唯一id
 */
export const generateId = (): string => {
  return Number(Math.random().toString().substr(3, 3) + Date.now()).toString(36);
};
