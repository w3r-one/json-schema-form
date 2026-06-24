import {
	createContext,
	type ElementType,
	type FormEvent,
	type ForwardedRef,
	forwardRef,
	memo,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useCallback,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
} from "react";
import set from "lodash.set";
import { setAutoFreeze, produce } from "immer";
import type { FieldDependency, FieldSchema, FormSchema } from "./types.js";
import { FormStore } from "./FormStore.js";
import { ErrorBoundary } from "react-error-boundary";
import { match, P } from "ts-pattern";
import * as R from "remeda";

setAutoFreeze(false);

export type FormProps<ResponseDataType = unknown> = {
	schema: FormSchema;
	action?: string;
	submitLabel?: string;
	// TODO Make it impossible to pass both `initialValue` and `value`
	initialValue?: Value;
	value?: Value;
	children?: ReactNode;
	onSuccess?: ((data: ServerResponse<ResponseDataType>) => void) | undefined;
	onError?: ((error: unknown) => void) | undefined;
	onSubmit?: ((e: FormEvent<HTMLFormElement>) => void) | undefined;
	onValueChange?: (value: Value) => void;
	components?: Partial<Components>;
	fieldMapper: FieldMapper;
	valueReducer?: (value: Value, action: Action) => Value;
	id?: string;
	initialErrors?: FormErrors;
};

export type Components = {
	Root: ElementType<RootProps>;
	Actions: ElementType<ActionProps>;
	ActionsWrapper: ElementType<ActionsWrapperProps>;
};

type RootProps = { children?: ReactNode };
type ActionProps = {
	submitLabel: NonNullable<FormProps<unknown>["submitLabel"]>;
};
type ActionsWrapperProps = { children?: ReactNode };

export type CompiledFormSchema = FormSchema & {
	root: true;
};

export type Value = Record<string, ValueLeaf>;
export type ValueLeaf =
	| string
	| number
	| Array<string>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	| Array<any>
	| boolean
	| { [key: string]: ValueLeaf };

const _Form = <ResponseDataType = unknown,>(
	{
		schema: schemaProps,
		action: actionProps,
		submitLabel = "Submit",
		initialValue,
		value: valueProps,
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
	ref: ForwardedRef<HTMLFormElement>,
) => {
	const schema = useMemo(() => compileSchema(schemaProps), [schemaProps]);
	const name = schema.title;

	const action =
		actionProps || schema.options.form.action || window.location.toString();

	const method = schema.options.form.method;

	const isControlled = valueProps !== undefined && onValueChange !== undefined;
	const storeRef = useRef<FormStore | null>(null);
	const renderedFieldRegistryRef = useRef<RenderedFieldRegistry | null>(null);

	if (storeRef.current === null) {
		storeRef.current = new FormStore(
			valueProps ?? initialValue ?? {},
			initialErrors,
		);
	}
	if (renderedFieldRegistryRef.current === null) {
		renderedFieldRegistryRef.current = new RenderedFieldRegistry();
	}

	const store = storeRef.current;
	const renderedFieldRegistry = renderedFieldRegistryRef.current;
	store.configure({ isControlled, onValueChange });

	useLayoutEffect(() => {
		if (isControlled && valueProps !== undefined) {
			store.synchronizeValue(valueProps);
		}
	}, [isControlled, store, valueProps]);

	const [request, sendRequest] = useFormRequest<ResponseDataType>({
		onSuccess,
		onError,
		initialErrors,
	});

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		onSubmit?.(e);

		if (!schema.options.form.async) {
			return;
		}

		if (!e.defaultPrevented) {
			e.preventDefault();
			sendRequest(e.currentTarget);
		}
	};

	const errors =
		(request.status === "error" &&
			request.error instanceof ServerError &&
			request.error.errors) ||
		null;

	useEffect(() => {
		store.replaceErrors(errors);
	}, [errors, store]);

	const handleReset = () => {
		store.replaceValue(
			valueReducerProps
				? valueReducerProps(store.getValue(), { type: "reset" })
				: {},
		);
	};

	const handleFieldChange = useCallback(
		(name: string, fieldValue: ValueLeaf) => {
			const linkedFields = getLinkedFields(schema, name) as Map<
				string,
				FieldSchema
			> | null;

			const action: Change = {
				type: "change",
				payload: { name, value: fieldValue, linkedFields },
			};
			store.replaceValue(
				valueReducerProps
					? valueReducerProps(store.getValue(), action)
					: getNextValue(store.getValue(), name, fieldValue, linkedFields),
			);
		},
		[schema, store, valueReducerProps],
	);

	const context = useMemo(
		() => ({ schema, store, handleFieldChange }),
		[handleFieldChange, schema, store],
	);

	const components = { ...DEFAULT_COMPONENTS, ...componentsProps };

	return (
		<FieldMapperContext.Provider value={fieldMapper}>
			<FormRequestContext.Provider value={request}>
				<RenderedFieldRegistryContext.Provider value={renderedFieldRegistry}>
					<FormContext.Provider value={context}>
						<form
						action={action}
						method={method}
						onSubmit={handleSubmit}
						onReset={handleReset}
						ref={ref}
						id={id}
					>
						{children ? (
							children
						) : (
							<components.Root>
								<AutoField name={name} />
								<components.ActionsWrapper>
									<components.Actions submitLabel={submitLabel} />
								</components.ActionsWrapper>
							</components.Root>
						)}
						</form>
					</FormContext.Provider>
				</RenderedFieldRegistryContext.Provider>
			</FormRequestContext.Provider>
		</FieldMapperContext.Provider>
	);
};

export const Form = forwardRef(_Form);

declare module "react" {
	function forwardRef<T, P = object>(
		render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
	): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

const Actions = (props: ActionProps) => {
	const request = useFormRequestContext();

	return (
		<button type="submit" disabled={request.status === "loading"}>
			{props.submitLabel}
		</button>
	);
};

const DEFAULT_COMPONENTS: Components = {
	Root: "div",
	Actions,
	ActionsWrapper: "div",
};

const FormContext = createContext<FormContextValue | null>(null);

type FormContextValue = {
	schema: FormSchema;
	store: FormStore;
	handleFieldChange: (name: string, value: ValueLeaf) => void;
};

export const useForm = () => {
	const context = useContext(FormContext);
	if (!context) {
		throw new Error(`useForm must be used in a Form`);
	}

	const value = useSyncExternalStore(
		context.store.subscribeToAllValues,
		context.store.getValue,
		context.store.getValue,
	);
	const errors = useSyncExternalStore(
		context.store.subscribeToAllErrors,
		context.store.getErrors,
		context.store.getErrors,
	);

	return { ...context, value, errors };
};

export type FieldComponentProps = {
	name: string;
	required?: boolean;
};

export type FieldMapper = (
	fieldSchema: FieldSchema,
) => ElementType<FieldComponentProps> | null;

type AutoFieldProps = {
	name: string;
	required?: boolean;
};

export type FormRestProps = {
	name: string;
};

type RenderedFieldListener = () => void;

class RenderedFieldRegistry {
	private readonly fieldCounts = new Map<string, number>();
	private readonly listeners = new Set<RenderedFieldListener>();
	private fieldNames = new Set<string>();

	register(fieldName: string) {
		this.fieldCounts.set(fieldName, (this.fieldCounts.get(fieldName) ?? 0) + 1);
		this.updateFieldNames();

		return () => {
			const count = this.fieldCounts.get(fieldName);
			if (count === undefined || count === 1) {
				this.fieldCounts.delete(fieldName);
			} else {
				this.fieldCounts.set(fieldName, count - 1);
			}
			this.updateFieldNames();
		};
	}

	subscribe = (listener: RenderedFieldListener) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getFieldNames = () => this.fieldNames;

	private updateFieldNames() {
		this.fieldNames = new Set(this.fieldCounts.keys());
		for (const listener of this.listeners) {
			listener();
		}
	}
}

const RenderedFieldRegistryContext =
	createContext<RenderedFieldRegistry | null>(null);
const IsFormRestFieldContext = createContext(false);

const useRenderedFieldRegistry = () => {
	const registry = useContext(RenderedFieldRegistryContext);

	if (registry === null) {
		throw new Error(`Rendered field registry must be used in a Form`);
	}

	return registry;
};

const LinkedField = ({
	name,
	schema,
	component: Component,
	required,
}: {
	name: string;
	schema: FieldSchema;
	component: ElementType<FieldComponentProps>;
	required: boolean;
}) => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const dependency = schema.options.dependencies![0];
	const parentFieldName = getParentName(name);
	const linkedFieldName = `${parentFieldName}[${dependency.property}]`;

	const linkedField = useField(linkedFieldName);

	const shouldShow =
		linkedField.value !== undefined &&
		shouldShowField(dependency, linkedField.value);

	if (shouldShow) {
		return <Component name={name} required={required} />;
	}

	return null;
};

const shouldShowField = (
	dependency: FieldDependency,
	dependencyValue: ValueLeaf,
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

const partsToName = (parts: Array<string>) => {
	return parts.reduce((previousValue, currentValue, currentIndex) => {
		if (currentIndex === 0) {
			return currentValue;
		}

		return `${previousValue}[${currentValue}]`;
	}, "");
};

export const useFieldMeta = <SchemaType extends FieldSchema = FieldSchema>(
	fieldName: string,
): FieldMeta<SchemaType> => {
	const context = useContext(FormContext);

	if (!context) {
		throw new Error(`useFieldMeta must be used in a Form`);
	}

	const fieldSchema = getFieldSchema(
		context.schema,
		fieldName,
	) as unknown as SchemaType;

	return {
		name: fieldName,
		id: fieldNameToId(fieldName),
		schema: fieldSchema,
		label: fieldSchema.title,
		description: fieldSchema.description,
	};
};

export const useField = (fieldName: string): FieldState => {
	const context = useContext(FormContext);

	if (!context) {
		throw new Error(`useField must be used in a Form`);
	}

	const { store, handleFieldChange } = context;
	const field = useFieldMeta(fieldName);
	const subscribeToValue = useCallback(
		(listener: () => void) => store.subscribeToFieldValue(fieldName, listener),
		[fieldName, store],
	);
	const getValue = useCallback(
		() => store.getFieldValue(fieldName),
		[fieldName, store],
	);
	const subscribeToErrors = useCallback(
		(listener: () => void) => store.subscribeToFieldErrors(fieldName, listener),
		[fieldName, store],
	);
	const getErrors = useCallback(
		() => store.getFieldErrors(fieldName),
		[fieldName, store],
	);
	const fieldValue = useSyncExternalStore(subscribeToValue, getValue, getValue);
	const fieldErrors = useSyncExternalStore(
		subscribeToErrors,
		getErrors,
		getErrors,
	);

	const onChange = useCallback(
		(value: ValueLeaf) => {
			handleFieldChange(fieldName, value);
		},
		[fieldName, handleFieldChange],
	);

	const defaultValue =
		"default" in field.schema ? field.schema.default : undefined;
	const value = fieldValue ?? defaultValue;

	return {
		...field,
		...(value === undefined ? {} : { value }),
		onChange,
		errors: fieldErrors,
	};
};

export type FieldMeta<SchemaType extends FieldSchema = FieldSchema> = {
	name: string;
	id: string;
	label: string;
	description?: string | undefined;
	schema: SchemaType;
};

export type FieldState<SchemaType extends FieldSchema = FieldSchema> =
	FieldMeta<SchemaType> & {
		value?: ValueLeaf;
		defaultValue?: ValueLeaf;
		onChange?: (value: ValueLeaf) => void;
		errors: Array<string>;
		placeholder?: string;
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		schema,
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
			return getNextValue(
				value,
				action.payload.name,
				action.payload.value,
				action.payload.linkedFields,
			);

		case "reset":
			return {};
	}
};

const getNextValue = (
	currentValue: Value,
	updatedFieldName: string,
	updatedFieldValue: ValueLeaf,
	linkedFields: Map<string, FieldSchema> | null,
) => {
	return produce(currentValue, (draftValue) => {
		set(draftValue, updatedFieldName, updatedFieldValue);

		if (
			linkedFields &&
			shouldResetLinkedFields({
				linkedFields,
				name: updatedFieldName,
				value: updatedFieldValue,
			})
		) {
			for (const entry of linkedFields) {
				const [linkedFieldName, linkedFieldSchema] = entry;

				let newValue: string | boolean = "";

				if (linkedFieldSchema.type === "boolean") {
					newValue = false;
				}

				set(draftValue, linkedFieldName, newValue);
			}
		}
	});
};

const shouldResetLinkedFields = (
	payload: Change["payload"],
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
		status: number,
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

export type FormErrors = Record<string, Array<string>>;

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
			}),
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
			}),
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
					fieldNameParts[fieldNameParts.length - 1],
			)
			.map((entry) => [`${parentFieldName}[${entry[0]}]`, entry[1]]),
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
	action: FormRequestAction<ResponseDataType>,
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
			response.status,
		);

		throw error;
	}
};

const FieldMapperContext = createContext<FieldMapper | undefined>(undefined);

export const useFieldMapper = () => {
	const ctx = useContext(FieldMapperContext);

	if (ctx === undefined) {
		throw new Error(
			"`useFieldMapper` must be used in a component wrapped in a `FieldMapperContext.Provider`",
		);
	}

	return ctx;
};

export const AutoField = memo(function AutoFieldRaw({
	name,
	required = false,
}: AutoFieldProps) {
	const field = useFieldMeta(name);
	const fieldMapper = useFieldMapper();
	const renderedFieldRegistry = useRenderedFieldRegistry();
	const isFormRestField = useContext(IsFormRestFieldContext);
	const FieldComponent = fieldMapper(field.schema);

	useLayoutEffect(() => {
		if (isFormRestField) {
			return;
		}

		return renderedFieldRegistry.register(name);
	}, [isFormRestField, name, renderedFieldRegistry]);

	useEffect(() => {
		if (!FieldComponent) {
			console.warn(
				"No field component returned by field mapper for the following field schema:",
				field.schema,
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
					name={name}
					schema={field.schema}
					component={FieldComponent}
					required={required}
				/>
			</ErrorBoundary>
		);
	}

	return <FieldComponent name={name} required={required} />;
});

export const FormRest = memo(function FormRest({ name }: FormRestProps) {
	const field = useFieldMeta(name);
	const renderedFieldRegistry = useRenderedFieldRegistry();
	const renderedFieldNames = useSyncExternalStore(
		renderedFieldRegistry.subscribe,
		renderedFieldRegistry.getFieldNames,
		renderedFieldRegistry.getFieldNames,
	);

	if (field.schema.type !== "object") {
		throw new Error(`FormRest requires an object field: ${name}`);
	}
	const requiredProperties =
		"required" in field.schema && Array.isArray(field.schema.required)
			? field.schema.required
			: [];

	return (
		<IsFormRestFieldContext.Provider value={true}>
			{Object.keys(field.schema.properties).map((propertyName) => {
				const fieldName = `${name}[${propertyName}]`;

				if (renderedFieldNames.has(fieldName)) {
					return null;
				}

				return (
					<AutoField
						key={fieldName}
						name={fieldName}
						required={requiredProperties.includes(propertyName)}
					/>
				);
			})}
		</IsFormRestFieldContext.Provider>
	);
});

const FormRequestContext = createContext<FormRequest<unknown> | undefined>(
	undefined,
);

export const useFormRequestContext = () => {
	const context = useContext(FormRequestContext);

	if (context === undefined) {
		throw new Error(
			"`useFormRequest` must be used in a component wrapper in a `FormRequestContext.Provider`",
		);
	}

	return context;
};
