export class vec2 {
	constructor(public x: number, public y: number) { }

	public copy(): vec2 {
		return new vec2(this.x, this.y);
	}

	public static add(lhs: vec2, rhs: vec2): vec2 {
		return new vec2(lhs.x + rhs.x, lhs.y + rhs.y);
	}

	public static subtract(lhs: vec2, rhs: vec2): vec2 {
		return new vec2(lhs.x - rhs.x, lhs.y - rhs.y);
	}

	public static scale(lhs: number, rhs: vec2): vec2 {
		return new vec2(lhs * rhs.x, lhs * rhs.y);
	}

	public static dot(lhs: vec2, rhs: vec2): number {
		return lhs.x * rhs.x + lhs.y * rhs.y;
	}

	public static cross(lhs: vec2, rhs: vec2): number {
		return lhs.x * rhs.y - lhs.y * rhs.x;
	}

	public static magnitude2(v: vec2): number {
		return vec2.dot(v, v);
	}

	public static magnitude(v: vec2): number {
		return Math.sqrt(vec2.magnitude2(v));
	}

	public static normalize(v: vec2): vec2 {
		let invLength = 1.0 / vec2.magnitude(v);
		return vec2.scale(invLength, v);
	}

	public static perpendicular(v: vec2): vec2 {
		return new vec2(-v.y, v.x);
	}

	public static polar(angle: number, radius: number) {
		return new vec2(radius * Math.cos(angle), radius * Math.sin(angle));
	}

	public static angle(v: vec2) {
		return Math.atan2(v.y, v.x);
	}

	public static get zero(): vec2 {
		return new vec2(0, 0);
	}

	public static get x(): vec2 {
		return new vec2(1, 0);
	}

	public static get y(): vec2 {
		return new vec2(0, 1);
	}
}

export class mat2 {
	constructor(public a: number, public b: number, public c: number, public d: number) { }

	public copy(): mat2 {
		return new mat2(this.a, this.b, this.c, this.d);
	}

	public static multiply(lhs: mat2, rhs: mat2): mat2 {
		return new mat2(lhs.a * rhs.a + lhs.b * rhs.c, lhs.a * rhs.b + lhs.b * rhs.d, lhs.c * rhs.a + lhs.d * rhs.c, lhs.c * rhs.b + lhs.d * rhs.d);
	}

	public static transform(lhs: mat2, rhs: vec2): vec2 {
		return new vec2(lhs.a * rhs.x + lhs.b * rhs.y, lhs.c * rhs.x + lhs.d * rhs.y);
	}
}