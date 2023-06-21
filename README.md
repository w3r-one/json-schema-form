# @w3rone/json-schema-form

React library to render forms based on JSON Schemas. It is primarily meant to be
used with our
[Symfony JSON Schema Bundle](https://github.com/w3r-one/json-schema-bundle). But
it can also be used without it.

## Install

```console
npm install --save-dev @w3rone/json-schema-form
```

## Usage

### Basic usage

```tsx
import { Form } from "@w3rone/json-schema-form";

const MyForm = () => {
	return <Form schema={schema} model={model} fieldMapper={fieldMapper} />;
};

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

const model = {
	user: {
		email: "john@doe.com",
		password: "this is a super secret password, don't try this at home.",
	},
};
```
