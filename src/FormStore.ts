import get from "lodash.get";
import type { FormErrors, Value, ValueLeaf } from "./Form.js";

type StoreConfiguration = {
	isControlled: boolean;
	onValueChange: ((value: Value) => void) | undefined;
};

type Listener = () => void;

export class FormStore {
	private value: Value;
	private errors: FormErrors | null;
	private configuration: StoreConfiguration = {
		isControlled: false,
		onValueChange: undefined,
	};
	private readonly valueListeners = new Map<string, Set<Listener>>();
	private readonly errorListeners = new Map<string, Set<Listener>>();
	private readonly allValueListeners = new Set<Listener>();
	private readonly allErrorListeners = new Set<Listener>();

	constructor(value: Value, errors: FormErrors | undefined) {
		this.value = value;
		this.errors = errors ?? null;
	}

	configure(configuration: StoreConfiguration) {
		this.configuration = configuration;
	}

	getValue = () => this.value;

	getFieldValue = (fieldName: string) =>
		get(this.value, fieldName) as ValueLeaf | undefined;

	getErrors = () => this.errors;

	getFieldErrors = (fieldName: string) =>
		this.errors?.[fieldName] ?? EMPTY_ERRORS;

	subscribeToAllValues = (listener: Listener) =>
		this.subscribe(this.allValueListeners, listener);

	subscribeToAllErrors = (listener: Listener) =>
		this.subscribe(this.allErrorListeners, listener);

	subscribeToFieldValue = (fieldName: string, listener: Listener) =>
		this.subscribeToField(this.valueListeners, fieldName, listener);

	subscribeToFieldErrors = (fieldName: string, listener: Listener) =>
		this.subscribeToField(this.errorListeners, fieldName, listener);

	replaceValue(nextValue: Value) {
		if (this.configuration.isControlled) {
			this.configuration.onValueChange?.(nextValue);
			return;
		}

		const previousValue = this.value;
		this.value = nextValue;
		this.notifyChangedFields(this.valueListeners, previousValue, nextValue);
		this.notify(this.allValueListeners);
	}

	synchronizeValue(nextValue: Value) {
		const previousValue = this.value;
		this.value = nextValue;
		this.notifyChangedFields(this.valueListeners, previousValue, nextValue);
		this.notify(this.allValueListeners);
	}

	replaceErrors(nextErrors: FormErrors | null) {
		const previousErrors = this.errors;
		this.errors = nextErrors;
		for (const [fieldName, listeners] of this.errorListeners) {
			if (
				(previousErrors?.[fieldName] ?? EMPTY_ERRORS) !==
				(nextErrors?.[fieldName] ?? EMPTY_ERRORS)
			) {
				this.notify(listeners);
			}
		}
		this.notify(this.allErrorListeners);
	}

	private subscribe(listeners: Set<Listener>, listener: Listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	private subscribeToField(
		listenersByField: Map<string, Set<Listener>>,
		fieldName: string,
		listener: Listener,
	) {
		const listeners = listenersByField.get(fieldName) ?? new Set<Listener>();
		listeners.add(listener);
		listenersByField.set(fieldName, listeners);

		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) {
				listenersByField.delete(fieldName);
			}
		};
	}

	private notifyChangedFields(
		listenersByField: Map<string, Set<Listener>>,
		previousValue: Value,
		nextValue: Value,
	) {
		for (const [fieldName, listeners] of listenersByField) {
			if (get(previousValue, fieldName) !== get(nextValue, fieldName)) {
				this.notify(listeners);
			}
		}
	}

	private notify(listeners: Set<Listener>) {
		for (const listener of listeners) {
			listener();
		}
	}
}

const EMPTY_ERRORS: Array<string> = [];
