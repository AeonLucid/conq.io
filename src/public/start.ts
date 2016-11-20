/// <reference path="../../node_modules/@types/jquery/index.d.ts"/>

let body: HTMLElement = document.body;
let engine: ConcreteEngine;

let vec2 = mvec.vec2;
type vec2 = mvec.vec2;

interface Tank {
	position: vec2;
	velocity: vec2;
	name: string;
	health: number;
	angle: number;
}

class ClientKeyboard {
	private m_input: number;

	constructor(input: number = 0) {
		this.m_input = input & 0xF;
	}

	public get left(): boolean {
		return this.get(0);
	}

	public get right(): boolean {
		return this.get(1);
	}

	public get up(): boolean {
		return this.get(2);
	}

	public get down(): boolean {
		return this.get(3);
	}

	public set left(value: boolean) {
		this.put(0, value);
	}

	public set right(value: boolean) {
		this.put(1, value);
	}
	
	public set up(value: boolean) {
		this.put(2, value);
	}

	public set down(value: boolean) {
		this.put(3, value);
	}

	public get binary(): number {
		return this.m_input & 0xF;
	}

	private get(k: number): boolean {
		return ((this.m_input >> k) & 1) === 1 ? true : false;
	}

	private set(k: number) {
		this.m_input |= (1 << k);
	}

	private clear(k: number) {
		this.m_input &= ~(1 << k);
	}

	private put(k: number, v: boolean) {
		if (v) this.set(k); else this.clear(k);
	}
}

function getKeyboardInput(arr: Set<number>) {
	let keys = new ClientKeyboard();
	keys.left = arr.has(65);
	keys.right = arr.has(68);
	keys.up = arr.has(87);
	keys.down = arr.has(83);
	return keys;
}

class ConcreteEngine extends render.BasicEngine {
	private m_keys: Set<number>;
	private m_socket: wsw.Socket;
	private m_user: Tank;

	protected init(g: render.Graphics, window: render.Window): void {
		this.m_keys = new Set<number>();
		this.m_user = { position: vec2.zero, velocity: vec2.zero, angle: 0, health: 1, name: "Elsa" };
		this.m_socket = new wsw.Socket("ws://localhost:3000");

		body.onkeydown = event => {
			this.m_keys.add(event.keyCode);
		}

		body.onkeyup = event => {
			this.m_keys.delete(event.keyCode);
		}
	}

	protected update(deltatime: number, window: render.Window): void {
		let keys = getKeyboardInput(this.m_keys);

		engine(this.m_user, deltatime, input(keys));

		function input(input: ClientKeyboard) {
			let result = vec2.zero;
			let force = 6.351;

			result.x -= input.left ? 1 : 0;
			result.x += input.right ? 1 : 0;
			result.y += input.up ? 1 : 0;
			result.y -= input.down ? 1 : 0;

			if (result.x === 0 && result.y === 0)
				return vec2.zero;
			
			return vec2.scale(force, vec2.normalize(result));
		}

		function engine(tank: Tank, deltatime: number, acc: vec2) {
			let dt = deltatime;
			let momentum = 0.93;

			tank.velocity = vec2.add(tank.velocity, vec2.scale(dt, acc));
			tank.position = vec2.add(tank.position, vec2.scale(dt, tank.velocity));
			tank.velocity = vec2.scale(momentum, tank.velocity);
		}
	}

	protected fixedupdate(deltatime: number, window: render.Window): void { }
	
	protected render(sg: render.SimpleGraphics, deltatime: number, window: render.Window, vp: render.Viewport): void {
		sg.stroke(false).fill("#303030").prect(-vp.aspect, -1, 2 * vp.aspect, 2);

		sg.stroke(true).stroke("#2E15A2").fill("#0E15A0").ellipse(this.m_user.position, 0.1);
	}

	protected rendertext(sg: render.SimpleGraphics, deltatime: number, window: render.Window, vp: render.Viewport): void { }
}

function resizeCanvas() {
	let canvas = (<HTMLCanvasElement>document.getElementById("main_canvas"));
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	document.body.scrollTop = 0;
	document.body.style.overflow = 'hidden';
	engine.updateViewport();
	engine.run();
}

class Startup {
	public static main(): number {
		let canvas = (<HTMLCanvasElement>document.getElementById("main_canvas"));
		let context = canvas.getContext("2d");
		let g = <render.Graphics>context;

		engine = new ConcreteEngine(g, canvas);
		resizeCanvas();
		(() => {
			function main() {
				window.requestAnimationFrame(main);
				engine.run();
			}

			main();
		})();
		return 0;
	}
}

Startup.main();