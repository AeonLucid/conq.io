namespace util {
    export type Graphics = CanvasRenderingContext2D;

    export function toInt(value: number): number {
        return value | 0;
    }

    export function isInt(value: number): boolean {
        return value == toInt(value);
    }

    export function modulo(n: number, m: number): number {
        return ((n % m) + m) % m;
    }

    export function degrees(radians: number): number {
        return (radians / Math.PI) * 180.0;
    }

    export function radians(degrees: number): number {
        return (degrees / 180.0) * Math.PI;
    }

    export function wrapAngle(angle: number) {
        let pi = Math.PI;
        let pi2 = Math.PI * 2.0;

        angle = angle % pi2;
        angle = (angle + pi2) % pi2;
        if (angle > pi)
            angle -= pi2;
        return angle;
    }

    export function wrap(value: number, min: number, max: number): number {
        let sum = max - min;
        value = value % sum;
        value = (value + sum) % sum;
        if (value > max)
            value -= sum;
        return value;
    }
}