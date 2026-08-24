import { fireEvent, render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "./Form.stories.js";
import { test, expect, describe } from "vitest";
import {
	AutoField,
	Form,
	FormRest,
	type FieldMapper,
	type FieldComponentProps,
	type ValueLeaf,
	useField,
	useHasUnrenderedFields,
} from "./Form.js";
import type { FieldDependency, FieldSchema, FormSchema } from "./types.js";

const renderCounts = new Map<string, number>();

const CountingTextField = ({ name }: FieldComponentProps) => {
	const field = useField(name);
	renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);

	return (
		<input
			aria-label={field.name}
			value={String(field.value ?? "")}
			onChange={(event) => field.onChange?.(event.currentTarget.value)}
		/>
	);
};

const countingFieldMapper: FieldMapper = () => CountingTextField;

const ExpandedChoiceField = ({ name }: FieldComponentProps) => {
	const field = useField(name);

	if (!("enum" in field.schema)) {
		throw new Error("ExpandedChoiceField requires a choice schema");
	}

	return (
		<fieldset>
			<legend>{field.label}</legend>
			{field.schema.enum.map((value) => (
				<label key={value}>
					<input
						type="radio"
						name={field.name}
						value={value}
						checked={field.value === value}
						onChange={() => field.onChange?.(value)}
					/>
					{value}
				</label>
			))}
		</fieldset>
	);
};

const NamedTextField = ({ name }: FieldComponentProps) => {
	const field = useField(name);

	return (
		<input
			aria-label={field.name}
			name={field.name}
			value={String(field.value ?? "")}
			onChange={(event) => field.onChange?.(event.currentTarget.value)}
		/>
	);
};

const expandedChoiceFieldMapper: FieldMapper = (fieldSchema) =>
	"enum" in fieldSchema ? ExpandedChoiceField : NamedTextField;

const expandedChoiceSchema: FormSchema = {
	$id: "",
	$schema: "",
	title: "user",
	type: "object",
	properties: {
		type: {
			type: "string",
			title: "Type",
			enum: ["internal", "external"],
			options: {
				layout: "default",
				widget: "choice",
				choice: {
					enumTitles: ["Internal", "External"],
					expanded: true,
					multiple: false,
					placeholder: "",
					preferredChoices: [],
				},
			},
		},
		displayName: {
			type: "string",
			title: "Display name",
			options: { layout: "default", widget: "text" },
		},
	},
	required: [],
	options: {
		layout: "default",
		widget: "test",
		form: {
			action: "http://localhost/user",
			method: "POST",
			async: true,
		},
	},
};

const FormWithExpandedChoiceRest = ({
	renderType,
}: {
	renderType: boolean;
}) => (
	<Form
		schema={expandedChoiceSchema}
		fieldMapper={expandedChoiceFieldMapper}
		initialValue={{ user: { type: "internal" } }}
	>
		{renderType && <AutoField name="user[type]" />}
		<FormRest name="user" />
	</Form>
);

const ObjectField = ({ name }: FieldComponentProps) => {
	const field = useField(name);

	if (field.schema.type !== "object") {
		throw new Error("ObjectField requires an object schema");
	}

	return (
		<div>
			{Object.keys(field.schema.properties).map((fieldName) => (
				<AutoField key={fieldName} name={`${field.name}[${fieldName}]`} />
			))}
		</div>
	);
};

const textAndObjectFieldMapper: FieldMapper = (fieldSchema) => {
	if (fieldSchema.type === "object") {
		return ObjectField;
	}

	return CountingTextField;
};

const FormWithRest = ({ renderToken }: { renderToken: boolean }) => {
	const schema = Basic.args.schema;

	if (!schema) {
		throw new Error("Missing test schema");
	}

	return (
		<Form schema={schema} fieldMapper={countingFieldMapper}>
			{renderToken && <AutoField name="user[_token]" />}
			<FormRest name="user" />
		</Form>
	);
};

const HasUnrenderedFieldsStatus = ({ name }: { name: string }) => {
	const hasUnrenderedFields = useHasUnrenderedFields(name);

	return (
		<p>
			{name}: {hasUnrenderedFields ? "yes" : "no"}
		</p>
	);
};

const dependencyModeCases: Array<{
	mode: FieldDependency["mode"];
	dependencyValue: FieldDependency["value"];
	visibleValue: ValueLeaf;
	hiddenValue: ValueLeaf;
}> = [
	{
		mode: "equal",
		dependencyValue: "expected",
		visibleValue: "expected",
		hiddenValue: "other",
	},
	{
		mode: "equal",
		dependencyValue: ["expected", "alternative"],
		visibleValue: "alternative",
		hiddenValue: "other",
	},
	{
		mode: "not_equal",
		dependencyValue: "expected",
		visibleValue: "other",
		hiddenValue: "expected",
	},
	{
		mode: "not_equal",
		dependencyValue: ["expected", "alternative"],
		visibleValue: "other",
		hiddenValue: "alternative",
	},
	{
		mode: "in",
		dependencyValue: "expected",
		visibleValue: ["expected"],
		hiddenValue: ["other"],
	},
	{
		mode: "not_in",
		dependencyValue: "expected",
		visibleValue: ["other"],
		hiddenValue: ["expected"],
	},
];

const createLinkedFieldSchema = (
	mode: FieldDependency["mode"],
	dependencyValue: FieldDependency["value"],
): FormSchema => {
	const controllerSchema: FieldSchema =
		mode === "in" || mode === "not_in"
			? {
					type: "array",
					title: "Controller",
					options: {
						layout: "default",
						widget: "choice",
					},
				}
			: {
					type: "string",
					title: "Controller",
					options: {
						layout: "default",
						widget: "text",
					},
				};

	return {
		$id: "",
		$schema: "",
		title: "settings",
		type: "object",
		properties: {
			controller: controllerSchema,
			dependent: {
				type: "string",
				title: "Dependent",
				options: {
					layout: "default",
					widget: "text",
					dependencies: [
						{
							property: "controller",
							value: dependencyValue,
							mode,
						},
					],
				},
			},
		},
		required: [],
		options: {
			layout: "default",
			widget: "test",
			form: {
				action: "http://localhost/settings",
				method: "POST",
				async: true,
			},
		},
	};
};

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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		Object.values(properties).forEach((fieldSchema: any) => {
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

describe.each(dependencyModeCases)(
	"linked fields with $mode dependencies",
	({ mode, dependencyValue, visibleValue, hiddenValue }) => {
		test("renders the dependent field when the condition is satisfied", () => {
			render(
				<Form
					schema={createLinkedFieldSchema(mode, dependencyValue)}
					fieldMapper={countingFieldMapper}
					initialValue={{ settings: { controller: visibleValue } }}
				>
					<AutoField name="settings[controller]" />
					<AutoField name="settings[dependent]" />
				</Form>,
			);

			expect(
				screen.getByLabelText("settings[dependent]"),
			).toBeInTheDocument();
		});

		test("hides the dependent field when the condition is not satisfied", () => {
			render(
				<Form
					schema={createLinkedFieldSchema(mode, dependencyValue)}
					fieldMapper={countingFieldMapper}
					initialValue={{ settings: { controller: hiddenValue } }}
				>
					<AutoField name="settings[controller]" />
					<AutoField name="settings[dependent]" />
				</Form>,
			);

			expect(
				screen.queryByLabelText("settings[dependent]"),
			).not.toBeInTheDocument();
		});
	},
);

describe("FormRest", () => {
	test("does not duplicate an explicitly rendered expanded choice on initial mount", () => {
		const { container } = render(
			<FormWithExpandedChoiceRest renderType={true} />,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const typeControls = container.querySelectorAll('[name="user[type]"]');

		expect(typeControls).toHaveLength(2);
		expect(
			container.querySelectorAll(
				'[name="user[type]"][value="internal"]',
			),
		).toHaveLength(1);
		expect(new FormData(form).get("user[type]")).toBe("internal");
	});

	test("still renders genuinely unrendered fields beside an explicit choice", () => {
		render(<FormWithExpandedChoiceRest renderType={true} />);

		expect(screen.getByLabelText("user[displayName]")).toBeInTheDocument();
	});

	test("moves a dynamically removed explicit choice into FormRest", () => {
		const { container, rerender } = render(
			<FormWithExpandedChoiceRest renderType={true} />,
		);

		rerender(<FormWithExpandedChoiceRest renderType={false} />);

		const form = container.querySelector("form") as HTMLFormElement;
		expect(container.querySelectorAll('[name="user[type]"]')).toHaveLength(2);
		expect(new FormData(form).get("user[type]")).toBe("internal");
	});

	test("replaces a FormRest choice when an explicit choice is dynamically added", () => {
		const { container, rerender } = render(
			<FormWithExpandedChoiceRest renderType={false} />,
		);

		rerender(<FormWithExpandedChoiceRest renderType={true} />);

		const form = container.querySelector("form") as HTMLFormElement;
		expect(container.querySelectorAll('[name="user[type]"]')).toHaveLength(2);
		expect(
			container.querySelectorAll(
				'[name="user[type]"][value="internal"]',
			),
		).toHaveLength(1);
		expect(new FormData(form).get("user[type]")).toBe("internal");
	});

	test("renders properties that are not manually rendered", () => {
		render(<FormWithRest renderToken={true} />);

		expect(screen.getAllByLabelText("user[_token]")).toHaveLength(1);
		expect(screen.getByLabelText("user[email]")).toBeInTheDocument();
		expect(screen.getByLabelText("user[password]")).toBeInTheDocument();
	});

	test("renders a property when its manual AutoField is unmounted", () => {
		const { rerender } = render(<FormWithRest renderToken={true} />);

		expect(screen.getAllByLabelText("user[_token]")).toHaveLength(1);

		rerender(<FormWithRest renderToken={false} />);

		expect(screen.getAllByLabelText("user[_token]")).toHaveLength(1);
	});

	test("does not render a parent property when a descendant is manually rendered", () => {
		const schema: FormSchema = {
			$id: "",
			$schema: "",
			title: "site",
			type: "object",
			properties: {
				name: {
					type: "string",
					title: "Name",
					options: {
						layout: "default",
						widget: "text",
					},
				},
				interestPoint: {
					type: "object",
					title: "Interest point",
					properties: {
						note: {
							type: "string",
							title: "Note",
							options: {
								layout: "default",
								widget: "text",
							},
						},
						waterType: {
							type: "string",
							title: "Water type",
							options: {
								layout: "default",
								widget: "text",
							},
						},
					},
					options: {
						layout: "default",
						widget: "test",
					},
				},
			},
			required: [],
			options: {
				layout: "default",
				widget: "test",
				form: {
					action: "http://localhost/site",
					method: "POST",
					async: true,
				},
			},
		};

		render(
			<Form schema={schema} fieldMapper={textAndObjectFieldMapper}>
				<AutoField name="site[interestPoint][note]" />
				<FormRest name="site[interestPoint]" />
				<FormRest name="site" />
			</Form>,
		);

		expect(screen.getAllByLabelText("site[interestPoint][note]")).toHaveLength(
			1,
		);
		expect(
			screen.getAllByLabelText("site[interestPoint][waterType]"),
		).toHaveLength(1);
		expect(screen.getAllByLabelText("site[name]")).toHaveLength(1);
	});
});

describe("useHasUnrenderedFields", () => {
	test("returns whether an object field still has unrendered direct properties", () => {
		const schema = Basic.args.schema;

		if (!schema) {
			throw new Error("Missing test schema");
		}

		render(
			<Form schema={schema} fieldMapper={countingFieldMapper}>
				<AutoField name="user[_token]" />
				<HasUnrenderedFieldsStatus name="user" />
			</Form>,
		);

		expect(screen.getByText("user: yes")).toBeInTheDocument();
	});

	test("returns false when all direct properties are manually rendered", () => {
		const schema = Basic.args.schema;

		if (!schema) {
			throw new Error("Missing test schema");
		}

		render(
			<Form schema={schema} fieldMapper={countingFieldMapper}>
				<AutoField name="user[_token]" />
				<AutoField name="user[email]" />
				<AutoField name="user[password]" />
				<HasUnrenderedFieldsStatus name="user" />
			</Form>,
		);

		expect(screen.getByText("user: no")).toBeInTheDocument();
	});
});

test("only re-renders the changed field", () => {
	const schema = Basic.args.schema;

	if (!schema) {
		throw new Error("Missing test schema");
	}

	renderCounts.clear();
	render(
		<Form schema={schema} fieldMapper={countingFieldMapper}>
			<AutoField name="user[email]" />
			<AutoField name="user[password]" />
		</Form>,
	);

	const passwordRenderCount = renderCounts.get("user[password]");
	fireEvent.change(screen.getByLabelText("user[email]"), {
		target: { value: "john@doe.com" },
	});

	expect(renderCounts.get("user[email]")).toBeGreaterThan(1);
	expect(renderCounts.get("user[password]")).toBe(passwordRenderCount);
});
