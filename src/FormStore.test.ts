import { describe, expect, test, vi } from "vitest";
import { FormStore } from "./FormStore.js";

describe("FormStore", () => {
	test("returns initial values and errors, including nested field values", () => {
		const errors = { email: ["Invalid email"] };
		const store = new FormStore(
			{ user: { email: "john@example.com" }, enabled: true },
			errors,
		);

		expect(store.getValue()).toEqual({
			user: { email: "john@example.com" },
			enabled: true,
		});
		expect(store.getFieldValue("user[email]")).toBe("john@example.com");
		expect(store.getFieldValue("missing")).toBeUndefined();
		expect(store.getErrors()).toBe(errors);
		expect(store.getFieldErrors("email")).toBe(errors.email);
		expect(store.getFieldErrors("missing")).toEqual([]);
	});

	test("notifies changed field and all-value subscribers when replacing a value", () => {
		const store = new FormStore(
			{ user: { email: "john@example.com", name: "John" } },
			undefined,
		);
		const emailListener = vi.fn();
		const nameListener = vi.fn();
		const allValuesListener = vi.fn();

		store.subscribeToFieldValue("user[email]", emailListener);
		store.subscribeToFieldValue("user[name]", nameListener);
		store.subscribeToAllValues(allValuesListener);

		store.replaceValue({
			user: { email: "jane@example.com", name: "John" },
		});

		expect(emailListener).toHaveBeenCalledOnce();
		expect(nameListener).not.toHaveBeenCalled();
		expect(allValuesListener).toHaveBeenCalledOnce();
	});

	test("stops notifying a listener after it is unsubscribed", () => {
		const store = new FormStore({ email: "john@example.com" }, undefined);
		const listener = vi.fn();
		const unsubscribe = store.subscribeToFieldValue("email", listener);

		unsubscribe();
		store.replaceValue({ email: "jane@example.com" });

		expect(listener).not.toHaveBeenCalled();
	});

	test("delegates controlled value changes without replacing the current value", () => {
		const onValueChange = vi.fn();
		const store = new FormStore({ email: "john@example.com" }, undefined);
		const listener = vi.fn();
		store.configure({ isControlled: true, onValueChange });
		store.subscribeToAllValues(listener);

		store.replaceValue({ email: "jane@example.com" });

		expect(onValueChange).toHaveBeenCalledWith({ email: "jane@example.com" });
		expect(store.getValue()).toEqual({ email: "john@example.com" });
		expect(listener).not.toHaveBeenCalled();
	});

	test("synchronizes controlled values and notifies their subscribers", () => {
		const store = new FormStore({ email: "john@example.com" }, undefined);
		const fieldListener = vi.fn();
		const allValuesListener = vi.fn();
		store.configure({ isControlled: true, onValueChange: vi.fn() });
		store.subscribeToFieldValue("email", fieldListener);
		store.subscribeToAllValues(allValuesListener);

		store.synchronizeValue({ email: "jane@example.com" });

		expect(store.getValue()).toEqual({ email: "jane@example.com" });
		expect(fieldListener).toHaveBeenCalledOnce();
		expect(allValuesListener).toHaveBeenCalledOnce();
	});

	test("notifies only changed error fields and all-error subscribers", () => {
		const emailErrors = ["Invalid email"];
		const store = new FormStore(
			{},
			{ email: emailErrors, password: ["Too short"] },
		);
		const emailListener = vi.fn();
		const passwordListener = vi.fn();
		const allErrorsListener = vi.fn();

		store.subscribeToFieldErrors("email", emailListener);
		store.subscribeToFieldErrors("password", passwordListener);
		store.subscribeToAllErrors(allErrorsListener);

		store.replaceErrors({ email: emailErrors, password: ["Required"] });

		expect(emailListener).not.toHaveBeenCalled();
		expect(passwordListener).toHaveBeenCalledOnce();
		expect(allErrorsListener).toHaveBeenCalledOnce();

		store.replaceErrors(null);

		expect(emailListener).toHaveBeenCalledOnce();
		expect(passwordListener).toHaveBeenCalledTimes(2);
		expect(allErrorsListener).toHaveBeenCalledTimes(2);
	});
});
