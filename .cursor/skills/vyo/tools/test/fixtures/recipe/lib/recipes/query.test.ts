import { listRecipes } from "./query";

// Tests are not part of the picture: the scanner leaves this file out.
test("lists recipes", async () => {
  expect(await listRecipes()).toBeDefined();
});
