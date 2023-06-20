import "@testing-library/jest-dom";

// See https://github.com/testing-library/jest-dom/pull/483/
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
declare module "expect" {
	//eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface AsymmetricMatchers
		extends TestingLibraryMatchers<typeof expect.stringContaining, void> {}

	//eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Matchers<R>
		extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
}
