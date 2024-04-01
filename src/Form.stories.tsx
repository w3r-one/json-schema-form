import { useState } from "react";
import {
	Form,
	type FieldMapper,
	type FieldProps,
	AutoField,
	type Components,
	useFormRequestContext,
	type Value,
} from "./Form";
import type {
	FieldSchema,
	FormSchema,
	ObjectFieldSchema,
	StringFieldSchema,
} from "./types";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

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
