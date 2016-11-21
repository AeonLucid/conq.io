namespace bser {
	declare function bson(): any;

	function validateObject(check: any, object: any, level: number): boolean {
		const type = "object";
		if (typeof check !== type || typeof object !== type)
			return false;

		let checkKeys = Object.keys(check).sort();
		let objectKeys = Object.keys(object).sort();

		if (checkKeys.length !== objectKeys.length)
			return false;
		let count = objectKeys.length;

		for (let index = 0; index < count; index++) {
			let checkElement = check[checkKeys[index]];
			let objectElement = object[objectKeys[index]];
			let good = validatePrimitive(checkElement, objectElement, level + 1) ||
				validateArray(checkElement, objectElement, level + 1) || validateObject(checkElement, objectElement, level + 1);
			if (!good)
				return false;
		}
		return true;
	}

	function validatePrimitive(check: any, object: any, level: number): boolean {
		let checkType = typeof check;
		let objectType = typeof object;

		const primitives = new Set<string>(["boolean", "number", "string"]);

		if (!primitives.has(checkType))
			return false;

		let good = checkType === objectType;
		return good;
	}

	function validateArray(check: any, object: any, level: number): boolean {
		const type = "object";
		if (typeof check !== type || typeof object !== type)
			return false;
		if (!(check instanceof Array && object instanceof Array))
			return false;

		let checkArray = <any[]>check;
		let objectArray = <any[]>object;

		if (checkArray.length < 0 || objectArray.length < 0)
			return false;
		if (checkArray.length === 0 && objectArray.length !== 0)
			return false;

		let count = objectArray.length;

		for (let index = 0; index < count; index++) {
			let checkElement = checkArray[0];
			let objectElement = objectArray[index];
			let good = validatePrimitive(checkElement, objectElement, level + 1) ||
				validateArray(checkElement, objectElement, level + 1) || validateObject(checkElement, objectElement, level + 1);
			if (!good)
				return false;
		}
		return true;
	}

	function toArrayBuffer(buffer: Uint8Array, padding: number = 0): ArrayBuffer {
		let result = new ArrayBuffer(buffer.length + padding);
		let view = new Uint8Array(result);
		for (let i = 0; i < buffer.length; ++i)
			view[i + padding] = buffer[i];
		return result;
	}

	function toNativeBuffer(buffer: ArrayBuffer, padding: number = 0): Uint8Array {
		let result = new Uint8Array(buffer.byteLength - 2);
		let view = new Uint8Array(buffer);

		for (let i = 0; i < result.length; ++i)
			result[i] = view[i + padding];
		return result;
	}

	let bsonp = bson().BSON;

	export class Serializer<T> extends wsw.Serializer<T> {
		private m_object: T;

		constructor(object: T) {
			super();
			this.m_object = object;
		}

		public encode(object: T, padding: number = 0): ArrayBuffer {
			let data = bsonp.serialize(object, false, true, false);
			return toArrayBuffer(data, padding);
		}

		public decode(binary: ArrayBuffer, padding: number = 0): T | undefined {
			try {
				let buffer = toNativeBuffer(binary, padding);
				let object = bsonp.deserialize(buffer);
				if (!object)
					return undefined
				if (!this.validate(object))
					return undefined;
				return <T>object;
			} catch (err) {
				console.log(err);
				return undefined;
			}
		}

		private validate(object: any): boolean {
			return validateObject(this.m_object, object, 0);
		}
	}

	export function gen<T>(object: T): Serializer<T> {
		return new Serializer<T>(object);
	}
}