import { test, expect, describe } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react";
import * as stories from "./Form.stories";

const { Basic, CustomComponents } = composeStories(stories);

test("form element has the given id", () => {
	const id = "form";

	render(<Basic id={id} />);

	const btn = screen.getByRole<HTMLButtonElement>("button", { name: "Submit" });

	expect(btn.form).toHaveAttribute("id", id);
});

describe("when no children is given", () => {
	test("all fields are automatically rendered", () => {
		const { container } = render(<Basic />);

		const btn = screen.getByRole<HTMLButtonElement>("button", {
			name: "Submit",
		});

		if (!btn.form) {
			throw new Error("No form found");
		}

		const data = new FormData(btn.form);
		const names = Array.from(data.keys());

		names.forEach((name) => {
			expect(container.querySelector(`[name='${name}']`)).toBeInTheDocument();
		});

		expect(btn.form).toHaveFormValues({});
	});
});

describe("when children is given", () => {
	test("submit button is not rendered", () => {
		render(
			<Basic>
				<p>Children</p>
			</Basic>,
		);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	test("children are rendered", () => {
		render(
			<Basic>
				<p>Children</p>
			</Basic>,
		);

		expect(screen.getByText("Children")).toBeInTheDocument();
	});

	test("no field is automatically rendered", () => {
		render(
			<Basic>
				<p>Children</p>
			</Basic>,
		);

		const properties = Basic.args.schema?.properties || {};

		Object.values(properties).forEach((fieldSchema) => {
			expect(
				screen.queryByLabelText(fieldSchema.title),
			).not.toBeInTheDocument();
		});
	});
});

test("fields are hydrated with values from initialValue prop", () => {
	const initialValue = {
		user: {
			email: "john@doe.com",
			password: "this is a super secret password, don't try this at home.",
		},
	};

	render(<Basic initialValue={initialValue} />);

	const form = screen.getByRole<HTMLButtonElement>("button", {
		name: "Submit",
	}).form;

	expect(form).toHaveFormValues({
		"user[email]": initialValue.user.email,
		"user[password]": initialValue.user.password,
	});
});

describe("components prop", () => {
	test("components.Root is used when given", () => {
		render(<CustomComponents />);

		expect(screen.getByTestId("custom-root")).toBeInTheDocument();
	});

	test("components.Actions is used when given", () => {
		render(<CustomComponents />);

		expect(screen.getByTestId("custom-actions")).toBeInTheDocument();
	});

	test("components.ActionsWrapper is used when given", () => {
		render(<CustomComponents />);

		expect(screen.getByTestId("custom-actions-wrapper")).toBeInTheDocument();
	});
});

test("submit button uses the given submitLabel", () => {
	const submitLabel = "Plz submit me";

	render(<Basic submitLabel={submitLabel} />);

	expect(screen.getByRole("button", { name: submitLabel })).toBeInTheDocument();
});

test("default value", () => {
	render(<Basic />);

	const btn = screen.getByRole<HTMLButtonElement>("button", {
		name: "Submit",
	});

	if (!btn.form) {
		throw new Error("No form found");
	}

	expect(btn.form).toHaveFormValues({
		"user[_token]": "csrf-token",
	});
});
