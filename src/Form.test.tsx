import { test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import {
	Form,
	type FieldProps,
	AutoField,
	type FieldMapper,
	type Components,
} from "./Form";
import type { StringFieldSchema } from "./types";
import type { FieldSchema } from "./types";
import type { ObjectFieldSchema } from "./types";
import type { FormSchema } from "./types";

const schema: FormSchema = {
	$id: "",
	$schema: "",
	title: "user",
	type: "object" as const,
	properties: {
		email: {
			title: "Email",
			type: "string",
			options: {
				layout: "default",
				widget: "text",
			},
		},
		password: {
			title: "Password",
			type: "string",
			options: {
				layout: "default",
				widget: "password",
			},
		},
	},
	required: [],
	options: {
		layout: "default",
		widget: "test",
		form: {
			action: "http://localhost/user/register",
			method: "POST" as const,
			async: true,
		},
	},
};

const model = {};

const fieldMapper: FieldMapper = (fieldSchema: FieldSchema) => {
	if (fieldSchema.type === "string") {
		return TextField;
	}

	if (fieldSchema.type === "object") {
		return ObjectField;
	}

	return null;
};

const TextField = (props: FieldProps<StringFieldSchema>) => {
	return (
		<div>
			<label htmlFor={props.id}>{props.label}</label>
			<input
				type={props.schema.options.widget}
				name={props.name}
				id={props.id}
				required={props.required}
				value={props.value ? String(props.value) : ""}
				onChange={(e) => props.onChange?.(e.currentTarget.value)}
			/>
		</div>
	);
};

const ObjectField = (props: FieldProps<ObjectFieldSchema>) => {
	return (
		<fieldset>
			<legend id={props.id + "_label"}>{props.label}</legend>
			<div aria-labelledby={props.id + "_label"}>
				{Object.keys(props.schema.properties).map((fieldName) => {
					return (
						<AutoField key={fieldName} name={`${props.name}[${fieldName}]`} />
					);
				})}
			</div>
		</fieldset>
	);
};

test("form element has the given id", () => {
	const id = "form";

	render(
		<Form schema={schema} model={model} fieldMapper={fieldMapper} id={id} />
	);

	const btn = screen.getByRole<HTMLButtonElement>("button", { name: "Submit" });

	expect(btn.form).toHaveAttribute("id", id);
});

describe("when no children is given", () => {
	test("all fields are automatically rendered", () => {
		render(<Form schema={schema} model={model} fieldMapper={fieldMapper} />);

		for (const fieldSchema of Object.values(schema.properties)) {
			expect(screen.getByLabelText(fieldSchema.title)).toBeInTheDocument();
		}
	});
});

describe("when children is given", () => {
	test("children are rendered", () => {
		render(
			<Form schema={schema} model={model} fieldMapper={fieldMapper}>
				<p>Children</p>
			</Form>
		);

		expect(screen.getByText("Children")).toBeInTheDocument();
	});

	test("no field is automatically rendered", () => {
		render(
			<Form schema={schema} model={model} fieldMapper={fieldMapper}>
				<p>Children</p>
			</Form>
		);

		for (const fieldSchema of Object.values(schema.properties)) {
			expect(
				screen.queryByLabelText(fieldSchema.title)
			).not.toBeInTheDocument();
		}
	});
});

test("fields are hydrated with values from model prop", () => {
	const model = {
		user: {
			email: "john@doe.com",
			password: "this is a super secret password, don't try this at home.",
		},
	};

	render(<Form schema={schema} model={model} fieldMapper={fieldMapper} />);

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

		render(
			<Form
				schema={schema}
				model={model}
				fieldMapper={fieldMapper}
				components={{ RootInner }}
			/>
		);

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

		render(
			<Form
				schema={schema}
				model={model}
				fieldMapper={fieldMapper}
				components={{ SubmitButton }}
			/>
		);

		expect(screen.getByTestId("SubmitButton")).toBeInTheDocument();
	});

	test("components.SubmitButtonWrapper is used when given", () => {
		const SubmitButtonWrapper: Components["SubmitButtonWrapper"] = (props) => {
			return <div data-testid={"SubmitButtonWrapper"}>{props.children}</div>;
		};

		render(
			<Form
				schema={schema}
				model={model}
				fieldMapper={fieldMapper}
				components={{ SubmitButtonWrapper }}
			/>
		);

		expect(screen.getByTestId("SubmitButtonWrapper")).toBeInTheDocument();
	});
});

test("submit button uses the given submitLabel", () => {
	const submitLabel = "Plz submit me";

	render(
		<Form
			schema={schema}
			model={model}
			fieldMapper={fieldMapper}
			submitLabel={submitLabel}
		/>
	);

	expect(screen.getByRole("button", { name: submitLabel })).toBeInTheDocument();
});
