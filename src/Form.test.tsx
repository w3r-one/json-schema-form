import { test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { Form, type FieldProps, AutoField, type FieldMapper } from "./Form";
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
			/>
		</div>
	);
};

const ObjectField = (props: FieldProps<ObjectFieldSchema>) => {
	return (
		<div>
			<label htmlFor={props.id}>{props.label}</label>
			<div>
				{Object.keys(props.schema.properties).map((fieldName) => {
					return <AutoField key={fieldName} name={fieldName} />;
				})}
			</div>
		</div>
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
