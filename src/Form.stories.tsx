import { Form, type FieldMapper, type FieldProps, AutoField } from "./Form";
import type {
	FieldSchema,
	FormSchema,
	ObjectFieldSchema,
	StringFieldSchema,
} from "./types";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
	title: "Form",
	component: Form,
	tags: ["autodocs"],
} satisfies Meta<typeof Form>;

export default meta;

type Story = StoryObj<typeof meta>;

const schema: FormSchema = {
	$id: "",
	$schema: "",
	title: "user",
	type: "object" as const,
	properties: {
		_token: {
			title: "",
			type: "string",
			default: "csrf-token",
			options: {
				layout: "defaullt",
				widget: "hidden",
			},
		},
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

export const Basic: Story = {
	args: {
		schema,
		model: {},
		fieldMapper,
	},
};

export const CustomSubmitLabel = {
	...Basic,
	args: {
		...Basic.args,
		submitLabel: "Plz submit me",
	},
};
