import { useState } from "react";
import {
	Form,
	type FieldMapper,
	type FieldComponentProps,
	AutoField,
	FormRest,
	type Components,
	useField,
	useFieldMeta,
	useFormRequestContext,
	type Value,
} from "./Form.js";
import type { FieldSchema, FormSchema } from "./types.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

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

const TextField = ({ name, required }: FieldComponentProps) => {
	const field = useField(name);

	return (
		<div>
			<label htmlFor={field.id}>{field.label}</label>
			<input
				type={field.schema.options.widget}
				name={field.name}
				id={field.id}
				required={required}
				value={field.value ? String(field.value) : ""}
				onChange={(e) => field.onChange?.(e.currentTarget.value)}
			/>
		</div>
	);
};

const ObjectField = ({ name }: FieldComponentProps) => {
	const field = useFieldMeta(name);

	if (field.schema.type !== "object") {
		throw new Error("ObjectField requires an object schema");
	}

	return (
		<fieldset>
			<legend id={field.id + "_label"}>{field.label}</legend>
			<div aria-labelledby={field.id + "_label"}>
				{Object.keys(field.schema.properties).map((fieldName) => {
					return (
						<AutoField key={fieldName} name={`${field.name}[${fieldName}]`} />
					);
				})}
			</div>
		</fieldset>
	);
};

export const Basic: Story = {
	args: {
		schema,
		fieldMapper,
		onError: fn(),
		onSubmit: fn(),
		onSuccess: fn(),
		onValueChange: fn(),
	},
};

export const InitialValue: Story = {
	args: {
		...Basic.args,
		initialValue: {
			user: {
				email: "john@doe.com",
				password: "P@ssw0rd123",
			},
		},
	},
};

export const CustomSubmitLabel: Story = {
	...Basic,
	args: {
		...Basic.args,
		submitLabel: "Plz submit me",
	},
};

const CustomRoot: Components["Root"] = (props) => {
	return (
		<div
			style={{ border: "1px solid red", padding: "0.5rem" }}
			data-testid={"custom-root"}
		>
			{props.children}
		</div>
	);
};

const CustomActions: Components["Actions"] = (props) => {
	const request = useFormRequestContext();

	return (
		<div
			style={{ border: "1px solid blue", padding: "0.5rem" }}
			data-testid={"custom-actions"}
		>
			<button type={"button"}>Reset</button>
			<button type={"submit"} disabled={request.status === "loading"}>
				{props.submitLabel}
			</button>
		</div>
	);
};

const CustomActionsWrapper: Components["ActionsWrapper"] = (props) => {
	return (
		<div
			style={{ border: "1px solid green", padding: "0.5rem" }}
			data-testid={"custom-actions-wrapper"}
		>
			{props.children}
		</div>
	);
};

export const CustomComponents: Story = {
	args: {
		...Basic.args,
		components: {
			Root: CustomRoot,
			Actions: CustomActions,
			ActionsWrapper: CustomActionsWrapper,
		},
	},
};

export const Controlled: Story = {
	...Basic,
	render: (args) => {
		const [value, setValue] = useState<Value>({
			user: { email: "john@doe.com", password: "P@ssw0rd123" },
		});

		return <Form {...args} value={value} onValueChange={setValue} />;
	},
};

const restFieldMapper: FieldMapper = (fieldSchema: FieldSchema) => {
	if (fieldSchema.type === "string") {
		return TextField;
	}

	if (fieldSchema.type === "object") {
		return ObjectFieldWithRest;
	}

	return null;
};

const ObjectFieldWithRest = ({ name }: FieldComponentProps) => {
	const field = useFieldMeta(name);

	if (field.schema.type !== "object") {
		throw new Error("ObjectField requires an object schema");
	}

	return (
		<fieldset>
			<legend id={field.id + "_label"}>{field.label}</legend>
			<div aria-labelledby={field.id + "_label"}>
				<AutoField name={`${field.name}[_token]`} />
				<FormRest name={field.name} />
			</div>
		</fieldset>
	);
};

export const Rest: Story = {
	...Basic,
	args: {
		...Basic.args,
		fieldMapper: restFieldMapper,
	},
};
