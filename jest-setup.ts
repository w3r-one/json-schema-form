import "@testing-library/jest-dom/jest-globals";
import { setProjectAnnotations } from "@storybook/react";
import * as projectAnnotations from "./.storybook/preview";

// @ts-expect-error that's what the docs propose, but we get a TS error
setProjectAnnotations(projectAnnotations);
