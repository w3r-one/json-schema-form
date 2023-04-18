type CommonFieldSchema = {
	options: FieldOptions;
	title: string;
	description?: string;
	readOnly?: boolean;
};

type FieldOptions = {
	layout: string;
	widget: string;
	highlighted?: boolean;
	dependencies?: [FieldDependency, ...Array<FieldDependency>];
	attr?: FieldAttr;
	filterable?: boolean;
};

type FieldAttr = {
	icon?: string;
};

export type FieldDependency = {
	property: string;
	value: string;
	mode: "equal" | "not_equal" | "in" | "not_in";
};

export type ObjectFieldSchema = CommonFieldSchema & {
	properties: Record<string, FieldSchema>;
	type: "object";
};

export type StringFieldSchema = CommonFieldSchema & {
	type: "string";
	default?: string;
};

export type SimpleChoiceFieldSchema = StringFieldSchema & {
	enum: Array<string>;
	options: {
		choice: {
			enumTitles: Array<string>;
			expanded: boolean;
			multiple: false;
			placeholder: string;
			preferredChoices: Array<string>;
		};
	};
};

export type MultipleChoiceFieldSchema = ArrayFieldSchema & {
	items: {
		type: "string";
		enum: Array<string>;
	};
	minItems: number;
	options: {
		choice: {
			enumTitles: Array<string>;
			expanded: boolean;
			multiple: true;
			preferredChoices: Array<string>;
		};
	};
	uniqueItems: boolean;
};

export const isMultipleChoiceFieldSchema = (
	schema: FieldSchema
): schema is MultipleChoiceFieldSchema => {
	return (
		schema.type === "array" &&
		(schema as MultipleChoiceFieldSchema).options.choice !== undefined
	);
};

export type BooleanFieldSchema = CommonFieldSchema & {
	type: "boolean";
	default?: boolean;
};

type NumberFieldSchema = CommonFieldSchema & {
	type: "number";
	default?: number;
};

type IntegerFieldSchema = CommonFieldSchema & {
	type: "integer";
	default?: number;
};

type ArrayFieldSchema = CommonFieldSchema & {
	type: "array";
};

export type CollectionFieldSchema = ArrayFieldSchema & {
	items: FieldSchema | Array<FieldSchema>;
	options: {
		collection: {
			allowAdd: boolean;
			allowDelete: boolean;
		};
		itemTitleProperties?: Array<string>;
	};
};

export const isCollectionFieldSchema = (
	schema: FieldSchema
): schema is CollectionFieldSchema => {
	return (schema as CollectionFieldSchema).options.collection !== undefined;
};

export type AutocompleteFieldSchema = ObjectFieldSchema & {
	options: {
		autocomplete: {
			entity: string;
			id: string;
			label: string;
			params: Record<string, string> | null;
		};
	};
};

export const isAutocompleteFieldSchema = (
	schema: FieldSchema
): schema is AutocompleteFieldSchema => {
	return (schema as AutocompleteFieldSchema).options.autocomplete !== undefined;
};

export type FieldSchema =
	| ObjectFieldSchema
	| StringFieldSchema
	| BooleanFieldSchema
	| NumberFieldSchema
	| IntegerFieldSchema
	| ArrayFieldSchema
	| MultipleChoiceFieldSchema
	| SimpleChoiceFieldSchema
	| AutocompleteFieldSchema
	| CollectionFieldSchema;

export type FormSchema = {
	$id: string;
	$schema: string;
	options: FormSchemaOptions;
	title: string;
	type: "object";
	properties: ObjectFieldSchema["properties"];
	required: Array<string>;
};

type FormSchemaOptions = FieldOptions & {
	form: {
		action: string;
		async: boolean;
		method: "GET" | "POST" | "PUT" | "DELETE";
	};
};
