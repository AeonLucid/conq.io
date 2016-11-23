/// <reference path="../../node_modules/@types/jquery/index.d.ts"/>

let body: HTMLElement = document.body;
let engine: ConcreteEngine;


let displayname: string = "Unnamed";
let vec2 = mvec.vec2;
type vec2 = mvec.vec2;

let mat2 = mvec.mat2;
type mat2 = mvec.mat2;

interface Tank {
	position: vec2;
	velocity: vec2;
	name: string;
	id: number;
	angle: number;
	health: number;
}

interface StateUpdate {
	user: Tank;
	players: Tank[];
	bullets: Bullet[];
}

interface ClientIdentify {
	name: string;
}

interface ClientInput {
	input: number[];
	angle: number;
	shoot: boolean;
}

interface Bullet {
	id: number;
	position: vec2;
	velocity: vec2;
}

let StateUpdateCodec = bser.gen<StateUpdate>({
	user: { name: "", position: vec2.zero, velocity: vec2.zero, id: 0, angle: 0, health: 0 },
	players: [{ name: "", position: vec2.zero, velocity: vec2.zero, id: 0, angle: 0, health: 0 }], bullets: [{ id: 0, position: vec2.zero, velocity: vec2.zero }]
});
let ClientIdentifyCodec = bser.gen<ClientIdentify>({ name: "" });
let ClientInputCodec = bser.gen<ClientInput>({ input: [0], angle: 0, shoot: false });

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

class PlayerOffset {
	private m_currPosition: vec2;
	private m_destPosition: vec2;

	constructor(position: vec2) {
		this.m_currPosition = vec2.copy(position);
		this.m_destPosition = vec2.copy(position);
	}

	public update(factor: number) {
		let difference = vec2.subtract(this.m_destPosition, this.m_currPosition);
		this.m_currPosition = vec2.add(this.m_currPosition, vec2.scale(factor, difference));
	}

	public set destination(position: vec2) {
		this.m_destPosition = vec2.copy(position);
	}

	public get current() {
		return this.m_currPosition;
	}
}

class BulletInterpolate {
	private m_beforePosition: vec2;
	private m_afterPosition: vec2;
	private m_id: number;

	constructor(position: vec2, id: number) {
		this.m_beforePosition = vec2.copy(position);
		this.m_afterPosition = vec2.copy(position);
		this.m_id = id;
	}

	public update(position: vec2) {
		this.m_beforePosition = this.m_afterPosition;
		this.m_afterPosition = vec2.copy(position);
	}

	public currentPosition(time: number) {
		return vec2.add(vec2.scale(1 - time, this.m_beforePosition), vec2.scale(time, this.m_afterPosition));
	}

	public get id() {
		return this.m_id;
	}
}

class Interpolate {
	private m_beforePosition: vec2;
	private m_afterPosition: vec2;
	private m_beforeAngle: number;
	private m_afterAngle: number;
	private m_beforeHealth: number;
	private m_afterHealth: number;
	private m_id: number;
	private m_name: string;

	constructor(position: vec2, angle: number, id: number, name: string, health: number) {
		this.m_beforePosition = vec2.copy(position);
		this.m_afterPosition = vec2.copy(position);

		this.m_beforeAngle = angle;
		this.m_afterAngle = angle;

		this.m_beforeHealth = health;
		this.m_afterHealth = health;

		this.m_name = name;
		this.m_id = id;

	}

	public update(position: vec2, angle: number, health: number) {
		this.m_beforePosition = this.m_afterPosition;
		this.m_afterPosition = vec2.copy(position);

		this.m_beforeHealth = this.m_afterHealth;
		this.m_afterHealth = health;

		this.m_beforeAngle = util.wrapAngle(this.m_afterAngle);
		this.m_afterAngle = util.wrapAngle(angle);

		if (Math.abs(this.m_afterAngle - this.m_beforeAngle) > Math.PI) {
			if (this.m_afterAngle > this.m_beforeAngle) {
				this.m_beforeAngle += Math.PI * 2;
			} else {
				this.m_afterAngle += Math.PI * 2;
			}
		}

		if (Math.abs(this.m_afterAngle - this.m_beforeAngle) > Math.PI) {
			console.log(Math.abs(this.m_afterAngle - this.m_beforeAngle));
			console.log(this.m_beforeAngle + " -> " + this.m_afterAngle);
		}

	}

	public currentPosition(time: number) {
		return vec2.add(vec2.scale(1 - time, this.m_beforePosition), vec2.scale(time, this.m_afterPosition));
	}

	public currentAngle(time: number) {
		return (1 - time) * this.m_beforeAngle + time * this.m_afterAngle;
	}

	public currentHealth(time: number) {
		return (1 - time) * this.m_beforeHealth + time * this.m_afterHealth;
	}

	public get id() {
		return this.m_id;
	}

	public get name() {
		return this.m_name;
	}
}

class ConcreteEngine extends render.BasicEngine {
	private m_keys: Set<number>;
	private m_socket: wsw.Socket;
	private m_input: number[];
	private m_offset: PlayerOffset;
	private m_user: Tank;
	private m_players: Tank[];
	private m_timeInterpolation: number;
	private m_userInt: Interpolate;
	private m_playersInt: Interpolate[];
	private m_angle: number;
	private m_shoot: boolean;
	private m_cursor: vec2;

	private m_bullets: Bullet[];
	private m_bulletsInt: BulletInterpolate[];

	protected init(g: render.Graphics, window: render.Window): void {
		this.m_keys = new Set<number>();
		this.m_user = { position: vec2.zero, velocity: vec2.zero, name: "", id: 0, angle: 0, health: 1 };
		this.m_players = [];
		this.m_socket = new wsw.Socket("wss://conq-io.herokuapp.com/");
		//this.m_socket = new wsw.Socket("ws://localhost:3000/");

		this.m_shoot = false;
		this.m_input = [];
		this.m_offset = new PlayerOffset(this.m_user.position);
		this.m_userInt = new Interpolate(vec2.zero, 0, 0, "You", 1);
		this.m_timeInterpolation = 0;
		this.m_playersInt = [];
		this.m_bulletsInt = [];
		this.m_bullets = [];
		this.m_cursor = vec2.zero;

		let on = this.m_socket.on;

		on.open.do(event => {
			let send = event.app.serialize(ClientIdentifyCodec, 0x01, 0x00);
			send({ name: displayname });
		});

		on.game(0x01).do(event => {

			let bpio = event.bpio(StateUpdateCodec, ClientInputCodec);
			if (!bpio.valid)
				return;

			this.m_userInt = new Interpolate(this.m_userInt.currentPosition(this.m_timeInterpolation), 0, 0, "You", 1);
			this.m_userInt.update(bpio.input.user.position, 0, 1);

			let playersInt: Interpolate[] = [];
			let bulletsInt: BulletInterpolate[] = [];


			let resTank: Interpolate[] = [];
			for (let player of this.m_players) {
				let found = false;
				for (let playerInt of this.m_playersInt) {
					if (player.id === playerInt.id) {
						let int = new Interpolate(playerInt.currentPosition(this.m_timeInterpolation), playerInt.currentAngle(this.m_timeInterpolation), player.id, player.name, playerInt.currentHealth(this.m_timeInterpolation));
						int.update(player.position, player.angle, player.health);
						resTank.push(int);
						found = true;
						break;
					}
				}
				if (found)
					continue;
				let int = new Interpolate(player.position, player.angle, player.id, player.name, player.health);
				resTank.push(int);
			}



			let resBullet: BulletInterpolate[] = [];
			for (let bullet of this.m_bullets) {
				let found = false;
				for (let bulletInt of this.m_bulletsInt) {
					if (bullet.id === bulletInt.id) {
						let int = new BulletInterpolate(bulletInt.currentPosition(this.m_timeInterpolation), bullet.id);
						int.update(bullet.position);

						resBullet.push(int);
						found = true;
						break;
					}
				}

				if (found)
					continue;
				let int = new BulletInterpolate(bullet.position, bullet.id);
				resBullet.push(int);
			}



			this.m_playersInt = resTank;
			this.m_bulletsInt = resBullet;
			this.m_user = bpio.input.user;
			this.m_players = bpio.input.players;
			this.m_bullets = bpio.input.bullets;
			this.m_timeInterpolation = 0;

			bpio.send({ input: this.m_input, angle: this.m_angle, shoot: this.m_shoot });
			this.m_input = [];
		});

		body.onkeydown = event => {
			this.m_keys.add(event.keyCode);
		}

		body.onkeyup = event => {
			this.m_keys.delete(event.keyCode);
		}

		body.onmousemove = event => {
			this.m_cursor = new vec2(this.vp.ix(event.clientX), -this.vp.iy(event.clientY));
		}

		body.onmousedown = event => {
			this.m_shoot = true;
		}

		body.onmouseup = event => {
			this.m_shoot = false;
		}
	}

	protected update(deltatime: number, window: render.Window): void {
		if (this.m_user.health > 0) {
			let pivot = vec2.subtract(this.m_userInt.currentPosition(this.m_timeInterpolation), this.m_offset.current);
			this.m_angle = vec2.angle(vec2.subtract(this.m_cursor, pivot));
		}


		this.m_offset.destination = this.m_userInt.currentPosition(this.m_timeInterpolation);
		this.m_timeInterpolation += deltatime * 15;
		if (this.m_timeInterpolation >= 1) {
			this.m_timeInterpolation = 1;
		}

		let keys = getKeyboardInput(this.m_keys);
		if (this.m_input.length > 3)
			return;
		this.m_input.push(keys.binary);
		this.m_offset.update(0.06);
	}

	protected fixedupdate(deltatime: number, window: render.Window): void { }

	protected render(sg: render.SimpleGraphics, deltatime: number, window: render.Window, vp: render.Viewport): void {
		sg.stroke(false).fill(true).fill("#303030").prect(-vp.aspect, -1, 2 * vp.aspect, 2);

		let transform = this.m_offset.current;

		sg.stroke(4);

		{
			for (let bullet of this.m_bulletsInt) {
				let bulletPos = vec2.subtract(bullet.currentPosition(this.m_timeInterpolation), transform);
				sg.stroke(true).stroke("#430005").fill("#A30015").ellipse(vec2.add(bulletPos, new vec2(-0.025, -0.025)), 0.05);

			}
		}

		{

			let userPos = vec2.subtract(this.m_userInt.currentPosition(this.m_timeInterpolation), transform);

			// Barrel
			let xcoord = vec2.polar(this.m_angle, 1.0);
			let ycoord = vec2.polar(this.m_angle + Math.PI / 2, 1.0);

			// Body		
			let trans = (x: number, y: number) => {
				return vec2.add(userPos, vec2.add(vec2.scale(x, xcoord), vec2.scale(y, ycoord)));
			}

			sg.stroke(true).stroke("#202020").fill("#808080").quad(trans(0, -0.03), trans(0.19, -0.03), trans(0.19, 0.03), trans(0, 0.03));
			sg.stroke(true).stroke("#202020").fill("#808080").quad(trans(0, -0.07), trans(0.11, -0.03), trans(0.11, 0.03), trans(0, 0.07));
			sg.stroke(true).stroke(interpolateColor({ r: 0x43, g: 0x00, b: 0x05 }, { r: 0x00, g: 0x05, b: 0x40 }, this.m_user.health)).fill(interpolateColor({ r: 0xA3, g: 0x00, b: 0x15 }, { r: 0x0E, g: 0x15, b: 0xA0 }, this.m_user.health)).ellipse(vec2.add(userPos, new vec2(-0.08, -0.08)), 0.16);
		}

		{
			for (let player of this.m_playersInt) {
				{
					let userPos = vec2.subtract(player.currentPosition(this.m_timeInterpolation), transform);

					// Barrel
					let xcoord = vec2.polar(player.currentAngle(this.m_timeInterpolation), 1.0);
					let ycoord = vec2.polar(player.currentAngle(this.m_timeInterpolation) + Math.PI / 2, 1.0);

					// Body		
					let trans = (x: number, y: number) => {
						return vec2.add(userPos, vec2.add(vec2.scale(x, xcoord), vec2.scale(y, ycoord)));
					}

					sg.stroke(true).stroke("#202020").fill("#808080").quad(trans(0, -0.03), trans(0.19, -0.03), trans(0.19, 0.03), trans(0, 0.03));
					sg.stroke(true).stroke("#202020").fill("#808080").quad(trans(0, -0.07), trans(0.11, -0.03), trans(0.11, 0.03), trans(0, 0.07));
					sg.stroke(true).stroke(interpolateColor({ r: 0x43, g: 0x00, b: 0x05 }, { r: 0x00, g: 0x05, b: 0x40 }, player.currentHealth(this.m_timeInterpolation))).fill(interpolateColor({ r: 0xA3, g: 0x00, b: 0x15 }, { r: 0x0E, g: 0x15, b: 0xA0 }, player.currentHealth(this.m_timeInterpolation))).ellipse(vec2.add(userPos, new vec2(-0.08, -0.08)), 0.16);

				}
			}

		}

		{
			let drawLine = (ax: number, ay: number, bx: number, by: number) => {
				let a = new vec2(ax, ay);
				let b = new vec2(bx, by);

				let ta = vec2.subtract(a, transform);
				let tb = vec2.subtract(b, transform);

				sg.pline(ta.x, ta.y, tb.x, tb.y);
			};

			sg.stroke(7).stroke(true).fill(true).stroke("#505050");
			drawLine(-3, 3, -3, -3);
			drawLine(-3, 3, 3, 3);
			drawLine(-3, -3, 3, -3);
			drawLine(3, 3, 3, -3);

			sg.stroke(3).stroke(true).fill(true).stroke("#808080");
			drawLine(-3.02, 3.02, -3.02, -3.02);
			drawLine(-3.02, 3.02, 3.02, 3.02);
			drawLine(-3.02, -3.02, 3.02, -3.02);
			drawLine(3.02, 3.02, 3.02, -3.02);
		}
	}
	protected rendertext(sg: render.SimpleGraphics, deltatime: number, window: render.Window, vp: render.Viewport): void {
		let transform = this.m_offset.current;
		sg.fill("#FFFFFF");
		sg.stroke("#000000");
		sg.g.textAlign = "center";
		sg.g.textBaseline = "middle";
		sg.g.font = 'normal bold 24px monospace';
		sg.g.lineWidth = 1;
		for (let player of this.m_playersInt) {
			let ps = vec2.subtract(player.currentPosition(this.m_timeInterpolation), transform);
			let offset = sg.g.measureText(player.name).width / 2;

			sg.g.fillText(player.name, vp.px(ps.x), vp.py(-(ps.y + 0.22)));
			sg.g.strokeText(player.name, vp.px(ps.x), vp.py(-(ps.y + 0.22)));

		}
	}
}

function getParam(name: string) {
	return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [undefined, ''])[1]!.replace(/\+/g, '%20')) || undefined;
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

		let displayname_ = getParam("name");
		if (displayname_)
			displayname = displayname_;

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

function componentToHex(c: number) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function interpolateColor(a: { r: number, g: number, b: number }, b: { r: number, g: number, b: number }, t: number) {
	let c = { r: 0, g: 0, b: 0 };
	let x = 1 - t;
	c.r = x * a.r + t * b.r;
	c.g = x * a.g + t * b.g;
	c.b = x * a.b + t * b.b;

	return rgbToHex(c.r | 0, c.g | 0, c.b | 0);
}