namespace util {
    export function toInteger(value: number): number {
        return value | 0;
    }

    export function isInteger(value: number): boolean {
        return value == toInteger(value);
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

    export class HighResolutionTimer {
        private totalTicks = 0;
        private timer: any;
        private startTime: number | undefined;
        private currentTime: number | undefined;
        private deltaTime = 0;

        constructor(public duration: number, public callback: (timer: HighResolutionTimer) => void) { /**/ }

        public run() {
            let lastTime = this.currentTime;
            this.currentTime = Date.now();

            if (!this.startTime) 
                this.startTime = this.currentTime;
            if (lastTime !== undefined)
                this.deltaTime = (this.currentTime - lastTime);

            this.callback(this);

            let nextTick = this.duration - (this.currentTime - (this.startTime + (this.totalTicks * this.duration)));
            this.totalTicks++;

            this.timer = setTimeout(() => {
                this.run();
            }, nextTick);
        }

        public stop() {
            if (this.timer !== undefined) {
                clearTimeout(this.timer);
                this.timer = undefined;
            }
        }
    }
}