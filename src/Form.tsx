import {
	createContext,
	type Dispatch,
	type ElementType,
	type FormEvent,
	type ForwardedRef,
	forwardRef,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useCallback,
} from "react";
import get from "lodash.get";
import set from "lodash.set";
import { setAutoFreeze, produce } from "immer";
import type { FieldDependency, FieldSchema, FormSchema } from "./types";
import { ErrorBoundary } from "react-error-boundary";
import { match, P } from "ts-pattern";
import * as R from "remeda";

setAutoFreeze(false);

export type FormProps<ResponseDataType = unknown> = {
	schema: FormSchema;
	action?: string;
	submitLabel?: string;
	model: Value;
	children?: ReactNode;
	onSuccess?: (data: ServerResponse<ResponseDataType>) => void;
	onError?: (error: unknown) => void;
	onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
	onValueChange?: (value: Value) => void;
	components?: Partial<Components>;
	fieldMapper: FieldMapper;
	valueReducer?: (value: Value, action: Action) => Value;
	id?: string;
	initialErrors?: FormErrors;
};

export type Components = {
	RootInner: ElementType<{ children?: ReactNode }>;
	SubmitButton: ElementType<SubmitButtonProps>;
	SubmitButtonWrapper: ElementType<{ children?: ReactNode }>;
};

type SubmitButtonProps = {
	status: FormRequestStatus;
	children?: ReactNode;
};

export type CompiledFormSchema = FormSchema & {
	root: true;
};

export type Value = Record<string, ValueLeaf>;
export type ValueLeaf =
	| string
	| string[]
	| any[]
	| boolean
	| { [key: string]: ValueLeaf };

const _Form = <ResponseDataType = unknown,>(
	{
		schema: schemaProps,
		action: actionProps,
		submitLabel = "Submit",
		model = {},
		children,
		onSuccess,
		onError,
		onSubmit,
		onValueChange,
		components: componentsProps,
		fieldMapper,
		valueReducer: valueReducerProps,
		id,
		initialErrors,
	}: FormProps<ResponseDataType>,
	ref: ForwardedRef<HTMLFormElement>
) => {
	const schema = useMemo(() => compileSchema(schemaProps), [schemaProps]);
	const name = schema.title;

	const action =
		actionProps || schema.options.form.action || window.location.toString();

	const method = schema.options.form.method;

	const [value, dispatch] = useReducer(
		valueReducerProps || valueReducer,
		method === "GET"
			? mergeModelWithSearchParams(
					model,
					new URLSearchParams(window.location.search)
			  )
			: model
	);

	useEffect(() => {
		if (onValueChange) {
			onValueChange(value);
		}
	}, [value]);

	const [request, sendRequest] = useFormRequest<ResponseDataType>({
		onSuccess,
		onError,
		initialErrors,
	});

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		onSubmit ? onSubmit(e) : null;

		if (!schema.options.form.async) {
			return;
		}

		if (!e.defaultPrevented) {
			e.preventDefault();
			sendRequest(e.currentTarget);
		}
	};

	const handleReset = () => {
		dispatch({ type: "reset" });
	};

	const errors =
		(request.status === "error" &&
			request.error instanceof ServerError &&
			request.error.errors) ||
		null;

	const context = { schema, value, dispatch, errors };

	const components = { ...DEFAULT_COMPONENTS, ...componentsProps };

	return (
		<FieldMapperContext.Provider value={fieldMapper}>
			<FormContext.Provider value={context}>
				<form
					action={action}
					method={method}
					onSubmit={handleSubmit}
					onReset={handleReset}
					ref={ref}
					id={id}
				>
					<components.RootInner>
						{children ? children : <AutoField name={name} />}
						<components.SubmitButtonWrapper>
							<components.SubmitButton status={request.status}>
								{submitLabel}
							</components.SubmitButton>
						</components.SubmitButtonWrapper>
					</components.RootInner>
				</form>
			</FormContext.Provider>
		</FieldMapperContext.Provider>
	);
};

export const Form = forwardRef(_Form);

declare module "react" {
	function forwardRef<T, P = object>(
		render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
	): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

const SubmitButton = ({ status, children }: SubmitButtonProps) => {
	return (
		<button type="submit" disabled={status === "loading"}>
			{children}
		</button>
	);
};

const SubmitButtonWrapper = "div";

const RootInner = "div";

const DEFAULT_COMPONENTS: Components = {
	RootInner,
	SubmitButton,
	SubmitButtonWrapper,
};

const FormContext = createContext<FormContextValue | null>(null);

type FormContextValue = {
	schema: FormSchema;
	value: Value;
	dispatch: Dispatch<Action>;
	errors: FormErrors | null;
};

export const useForm = () => {
	const context = useContext(FormContext);
	if (!context) {
		throw new Error(`useForm must be used in a Form`);
	}

	return context;
};

export type FieldMapper = (fieldSchema: FieldSchema) => ElementType | null;

type AutoFieldProps = {
	name: string;
	required?: boolean;
};

const LinkedField = ({
	field,
	component: Component,
	required,
}: {
	field: FieldProps;
	component: ElementType;
	required: boolean;
}) => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const dependency = field.schema.options.dependencies![0];
	const parentFieldName = getParentName(field.name);
	const linkedFieldName = `${parentFieldName}[${dependency.property}]`;

	const linkedField = useField(linkedFieldName);

	const shouldShow =
		linkedField.value !== undefined &&
		shouldShowField(dependency, linkedField.value);

	if (shouldShow) {
		return <Component {...field} required={required} />;
	}

	return null;
};

const shouldShowField = (
	dependency: FieldDependency,
	dependencyValue: ValueLeaf
) => {
	switch (dependency.mode) {
		case "equal":
			return Array.isArray(dependency.value)
				? dependency.value.includes(dependencyValue)
				: dependencyValue === dependency.value;

		case "not_equal":
			return Boolean(dependencyValue) && dependencyValue !== dependency.value;

		case "in":
			return (
				Array.isArray(dependencyValue) &&
				dependencyValue.includes(String(dependency.value))
			);

		case "not_in":
			return (
				!dependencyValue ||
				(Array.isArray(dependencyValue) &&
					!dependencyValue.includes(String(dependency.value)))
			);

		default:
			throw new Error(`Unknown linked field mode: ${dependency.mode}`);
	}
};

const LinkedFieldError = ({ error }: { error: Error }) => {
	useEffect(() => {
		console.error(error);
	}, []);

	return null;
};

export const getParentName = (name: string) => {
	const parts = getFieldNameParts(name);

	if (!parts) {
		throw new Error("Can't get parts");
	}

	return partsToName(parts.slice(0, -1));
};

const partsToName = (parts: string[]) => {
	return parts.reduce((previousValue, currentValue, currentIndex) => {
		if (currentIndex === 0) {
			return currentValue;
		}

		return `${previousValue}[${currentValue}]`;
	}, "");
};

export const useField = (fieldName: string): FieldProps => {
	const { schema, value, dispatch, errors } = useForm();

	const fieldSchema = getFieldSchema(schema, fieldName);
	const fieldValue = getFieldValue(value, fieldName);

	const onChange = (value: ValueLeaf) => {
		const linkedFields = getLinkedFields(schema, fieldName) as Map<
			string,
			FieldSchema
		> | null;

		dispatch({
			type: "change",
			payload: { name: fieldName, value, linkedFields },
		});
	};

	const fieldErrors = errors?.[fieldName] || [];

	return {
		value: fieldValue,
		onChange,
		name: fieldName,
		id: fieldNameToId(fieldName),
		schema: fieldSchema,
		label: fieldSchema.title,
		description: fieldSchema.description,
		errors: fieldErrors,
	};
};

export type FieldProps<SchemaType = FieldSchema> = {
	value?: ValueLeaf;
	defaultValue?: ValueLeaf;
	onChange?: (value: ValueLeaf) => void;
	name: string;
	id: string;
	label: string;
	description?: string;
	schema: SchemaType;
	errors: string[];
	placeholder?: string;
	required?: boolean;
};

export const getFieldSchema = (schema: FormSchema, fieldName: string) => {
	if (fieldName === schema.title) {
		return schema;
	}

	const fieldNameParts = getFieldNameParts(fieldName);
	const significantFieldNameParts =
		fieldNameParts?.[0] === schema.title
			? fieldNameParts.slice(1)
			: fieldNameParts;

	if (!significantFieldNameParts) {
		throw new Error(`Failed to get field schema: ${fieldName}`);
	}

	const fieldSchema = significantFieldNameParts.reduce(
		(prevSchema: any, fieldNamePart) => {
			if (Number.isNaN(Number(fieldNamePart))) {
				return prevSchema.properties[fieldNamePart];
			} else {
				if (Array.isArray(prevSchema.items)) {
					return prevSchema.items[fieldNamePart];
				} else {
					return prevSchema.items;
				}
			}
		},
		schema
	);

	if (!fieldSchema) {
		throw new Error(`Failed to get field schema: ${fieldName}`);
	}

	return fieldSchema;
};

export const getFieldNameParts = (fieldName: string) => {
	const matches = fieldName.match(/(\w|\d)+/g);

	if (matches) {
		return Array.from(matches);
	}

	return null;
};

export const getFieldName = (schema: FormSchema, fieldName: string) => {
	return `${schema.title}[${fieldName}]`;
};

const fieldNameToId = (fieldName: string): string => {
	const parts = getFieldNameParts(fieldName);

	if (!parts) {
		return "";
	}

	return parts.join("_");
};

const getFieldValue = (value: Value, fieldName: string) => {
	const path = fieldNameToValuePath(fieldName);
	const fieldValue = get(value, path);

	return fieldValue;
};

const fieldNameToValuePath = (fieldName: string): string => {
	const parts = getFieldNameParts(fieldName);

	if (!parts) {
		return "";
	}

	return parts.join(".");
};

type Action = Change | Reset;

type Change = {
	type: "change";
	payload: {
		name: string;
		value: ValueLeaf;
		linkedFields: Map<string, FieldSchema> | null;
	};
};

type Reset = { type: "reset" };

export const valueReducer = (value: Value, action: Action) => {
	switch (action.type) {
		case "change":
			return produce(value, (draftValue) => {
				set(draftValue, action.payload.name, action.payload.value);

				if (shouldResetLinkedFields(action.payload)) {
					for (const entry of action.payload.linkedFields) {
						const [linkedFieldName, linkedFieldSchema] = entry;

						let newValue: string | boolean = "";

						if (linkedFieldSchema.type === "boolean") {
							newValue = false;
						}

						set(draftValue, linkedFieldName, newValue);
					}
				}
			});

		case "reset":
			return {};
	}
};

const shouldResetLinkedFields = (
	payload: Change["payload"]
): payload is {
	[K in keyof Change["payload"]]: NonNullable<Change["payload"][K]>;
} => {
	return (
		(!Array.isArray(payload.value) || payload.value.length === 0) &&
		payload.linkedFields !== null
	);
};

export class ServerError extends Error {
	errors: FormErrors | null;
	status: number;

	constructor(
		message: string | null,
		errors: FormErrors | null,
		status: number
	) {
		super(message || "");

		this.errors = errors;
		this.status = status;
	}
}

export type ServerResponse<DataType = unknown> = {
	message: string | null;
	redirect_url: string | null;
	data: DataType;
	errors: FormErrors | null;
};

export type FormErrors = Record<string, string[]>;

const mergeModelWithSearchParams = (
	model: Value,
	searchParams: URLSearchParams
): Value => {
	const uniqueKeys = [...new Set(searchParams.keys())];

	return uniqueKeys.reduce((acc, key) => {
		const value = key.endsWith("[]")
			? searchParams.getAll(key)
			: searchParams.get(key) || "";

		const sanitizedKey = key.endsWith("[]") ? key.slice(0, -2) : key;

		set(acc, sanitizedKey, value);

		return acc;
	}, model);
};

const compileSchema = (rawSchema: FormSchema): CompiledFormSchema => {
	const compiledSchema = {
		...rawSchema,
		root: true as const,
		properties: R.mapValues(rawSchema.properties, compileFieldSchema),
	};

	return compiledSchema;
};

const compileFieldSchema = (fieldSchema: FieldSchema): FieldSchema => {
	const compiledFieldSchema = match(fieldSchema)
		.with(
			{ type: "object" },
			(schema): FieldSchema => ({
				...schema,
				properties: R.mapValues(schema.properties, compileFieldSchema),
			})
		)
		.with(
			{ type: "array", items: P.not(undefined) },
			/* @ts-expect-error ... */
			(schema): ArrayFieldSchema => ({
				...schema,
				items: Array.isArray(schema.items)
					? schema.items.map(compileFieldSchema)
					: /* @ts-expect-error ... */
					  compileFieldSchema(schema.items),
			})
		)
		.otherwise((schema) => schema);

	return {
		...compiledFieldSchema,
		title:
			compiledFieldSchema.title === "prototype"
				? ""
				: compiledFieldSchema.title,
	};
};

const getLinkedFields = (schema: FormSchema, fieldName: string) => {
	const fieldNameParts = getFieldNameParts(fieldName);

	if (!fieldNameParts) {
		throw new Error("Can't get field name parts");
	}

	const parentFieldName = getParentName(fieldName);
	const parentSchema = getFieldSchema(schema, parentFieldName);

	if (parentSchema.type !== "object") {
		return null;
	}

	const linkedFields = new Map(
		Object.entries(parentSchema.properties)
			.filter(
				(entry) =>
					(entry[1] as FieldSchema).options?.dependencies?.[0]?.property ===
					fieldNameParts[fieldNameParts.length - 1]
			)
			.map((entry) => [`${parentFieldName}[${entry[0]}]`, entry[1]])
	);

	return linkedFields;
};

type FormRequestProps<ResponseDataType = unknown> = {
	onSuccess?: FormProps<ResponseDataType>["onSuccess"];
	onError?: FormProps<ResponseDataType>["onError"];
	initialErrors?: FormProps<ResponseDataType>["initialErrors"];
};

export const useFormRequest = <ResponseDataType = unknown,>({
	onSuccess,
	onError,
	initialErrors,
}: FormRequestProps<ResponseDataType>) => {
	const [request, dispatch] = useReducer(formRequestReducer<ResponseDataType>, {
		status: initialErrors ? "error" : "idle",
		value: null,
		error: initialErrors ? new ServerError(null, initialErrors, 400) : null,
	});

	const call = useCallback(async (form: HTMLFormElement) => {
		dispatch({ type: "loading" });

		try {
			const response = await sendRequest<ResponseDataType>(form);
			dispatch({ type: "success", payload: response });
			onSuccess?.(response);
		} catch (error) {
			dispatch({ type: "error", payload: error });
			onError?.(error);
		}
	}, []);

	return [request, call] as const;
};

type FormRequest<ResponseDataType> = {
	status: FormRequestStatus;
	value: ServerResponse<ResponseDataType> | null;
	error: unknown | null;
};

type FormRequestStatus = "idle" | "loading" | "success" | "error";

type FormRequestAction<ResponseDataType> =
	| {
			type: "success";
			payload: ServerResponse<ResponseDataType>;
	  }
	| { type: "error"; payload: unknown }
	| { type: "loading" };

const formRequestReducer = <ResponseDataType,>(
	prevState: FormRequest<ResponseDataType>,
	action: FormRequestAction<ResponseDataType>
): FormRequest<ResponseDataType> => {
	if (action.type === "success") {
		return {
			...prevState,
			status: "success",
			value: action.payload,
			error: null,
		};
	}

	if (action.type === "error") {
		return {
			...prevState,
			status: "error",
			error: action.payload,
		};
	}

	if (action.type === "loading") {
		return {
			...prevState,
			status: "loading",
		};
	}

	return prevState;
};

const sendRequest = async <ResponseDataType,>(form: HTMLFormElement) => {
	const formData = new FormData(form);

	const url = new URL(form.action);

	if (form.method === "get") {
		url.search = new URLSearchParams(formData as any).toString();
	}

	const headers = new Headers({
		"X-Requested-With": "XMLHttpRequest",
		Accept: "application/json",
	});

	const req = new Request(url.toString(), {
		body: form.method === "post" ? formData : null,
		method: form.method,
		headers,
	});

	const response = await fetch(req);
	const responseData: ServerResponse<ResponseDataType> = await response.json();

	if (response.ok) {
		return responseData;
	} else {
		const error = new ServerError(
			responseData.message,
			responseData.errors,
			response.status
		);

		throw error;
	}
};

const FieldMapperContext = createContext<FieldMapper | undefined>(undefined);

export const useFieldMapper = () => {
	const ctx = useContext(FieldMapperContext);

	if (ctx === undefined) {
		throw new Error(
			"`useFieldMapper` must be used in a component wrapped in a `FieldMapperContext.Provider`"
		);
	}

	return ctx;
};

export const AutoField = ({ name, required = false }: AutoFieldProps) => {
	const field = useField(name);
	const fieldMapper = useFieldMapper();
	const FieldComponent = fieldMapper(field.schema);

	useEffect(() => {
		if (!FieldComponent) {
			console.warn(
				"No field component returned by field mapper for the following field schema:",
				field.schema
			);
		}
	}, [FieldComponent]);

	if (!FieldComponent) {
		return null;
	}

	if (field.schema.options.dependencies) {
		return (
			<ErrorBoundary FallbackComponent={LinkedFieldError}>
				<LinkedField
					field={field}
					component={FieldComponent}
					required={required}
				/>
			</ErrorBoundary>
		);
	}

	return <FieldComponent {...field} required={required} />;
};
