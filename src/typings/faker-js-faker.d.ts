declare module "@faker-js/faker" {
  // Re-export types from the dist/types path that TypeScript cannot resolve
  // under moduleResolution:"bundler" because the package's "exports" field
  // omits a "types" condition.
  import Faker from "@faker-js/faker/dist/types/faker";
  export const faker: InstanceType<typeof Faker>;
  export { Faker };
  export { FakerError } from "@faker-js/faker/dist/types/errors/faker-error";
  export { Gender } from "@faker-js/faker/dist/types/name";
  export type { GenderType } from "@faker-js/faker/dist/types/name";
  export default faker;
}
