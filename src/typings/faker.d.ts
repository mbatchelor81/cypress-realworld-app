declare module "@faker-js/faker" {
  import Faker from "@faker-js/faker/dist/types/faker";
  export { Faker };
  export const faker: InstanceType<typeof Faker>;
  export default faker;
}
