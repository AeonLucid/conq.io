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

export class HighResolutionTimer {
    private m_totalTicks = 0;
    private m_timer: NodeJS.Timer | undefined;
    private m_startTime: number | undefined;
    private m_currentTime: number | undefined;
    private m_deltaTime = 0;
    private m_duration: number;
    private m_callback: (m_timer: HighResolutionTimer) => void;

    constructor(duration: number, callback: (timer: HighResolutionTimer) => void) {
        this.m_duration = duration;
        this.m_callback = callback;
    }

    public run() {
        let lastTime = this.m_currentTime;
        this.m_currentTime = Date.now();

        if (!this.m_startTime)
            this.m_startTime = this.m_currentTime;
        if (!lastTime)
            this.m_deltaTime = (this.m_currentTime - lastTime);

        this.m_callback(this);
        let nextTick = this.m_duration - (this.m_currentTime - (this.m_startTime + (this.m_totalTicks * this.m_duration)));
        this.m_totalTicks++;

        this.m_timer = setTimeout(() => {
            this.run();
        }, nextTick);
    }

    public stop() {
        if (!this.m_timer) {
            clearTimeout(this.m_timer!);
            this.m_timer = undefined;
        }
    }
}