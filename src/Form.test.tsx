import { test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { type Components } from "./Form";
import { composeStories } from "@storybook/react";
import * as stories from "./Form.stories";

const { Basic } = composeStories(stories);

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
	test("children are rendered", () => {
		render(
			<Basic>
				<p>Children</p>
			</Basic>
		);

		expect(screen.getByText("Children")).toBeInTheDocument();
	});

	test("no field is automatically rendered", () => {
		render(
			<Basic>
				<p>Children</p>
			</Basic>
		);

		const properties = Basic.args.schema?.properties || {};

		Object.values(properties).forEach((fieldSchema) => {
			expect(
				screen.queryByLabelText(fieldSchema.title)
			).not.toBeInTheDocument();
		});
	});
});

test("fields are hydrated with values from model prop", () => {
	const model = {
		user: {
			email: "john@doe.com",
			password: "this is a super secret password, don't try this at home.",
		},
	};

	render(<Basic model={model} />);

	const form = screen.getByRole<HTMLButtonElement>("button", {
		name: "Submit",
	}).form;

	expect(form).toHaveFormValues({
		"user[email]": model.user.email,
		"user[password]": model.user.password,
	});
});

describe("components prop", () => {
	test("components.RootInner is used when given", () => {
		const RootInner: Components["RootInner"] = (props) => {
			return <div data-testid={"RootInner"}>{props.children}</div>;
		};

		render(<Basic components={{ RootInner }} />);

		expect(screen.getByTestId("RootInner")).toBeInTheDocument();
	});

	test("components.SubmitButton is used when given", () => {
		const SubmitButton: Components["SubmitButton"] = (props) => {
			return (
				<button type={"submit"} data-testid={"SubmitButton"}>
					{props.children}
				</button>
			);
		};

		render(<Basic components={{ SubmitButton }} />);

		expect(screen.getByTestId("SubmitButton")).toBeInTheDocument();
	});

	test("components.SubmitButtonWrapper is used when given", () => {
		const SubmitButtonWrapper: Components["SubmitButtonWrapper"] = (props) => {
			return <div data-testid={"SubmitButtonWrapper"}>{props.children}</div>;
		};

		render(<Basic components={{ SubmitButtonWrapper }} />);

		expect(screen.getByTestId("SubmitButtonWrapper")).toBeInTheDocument();
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
