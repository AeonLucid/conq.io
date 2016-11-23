import express = require("express");
import http = require("http");
import express_core = require("express-serve-static-core");
import bser = require("./basic-serializer");
import wsw = require("./socket");
import uws = require("./uws-socket");
import mvec = require("./vector");
import util = require("./utilities");

export let app: express_core.Express;
export let server: http.Server;

let vec2 = mvec.vec2;
type vec2 = mvec.vec2;

export function init() {
	// Initialize file routers
	app.get("/", (req, res) => {
		res.sendFile("../public/index.html");
	});
	require("./post-error")(app);

	main();
	console.log("Server is running");
}

let StateUpdateCodec = bser.gen<StateUpdate>({ user: { name: "", position: vec2.zero, velocity: vec2.zero, id: 0 },
	players: [ { name: "", position: vec2.zero, velocity: vec2.zero, id: 0 } ] });
let ClientIdentifyCodec = bser.gen<ClientIdentify>({ name: "" });
let ClientInputCodec = bser.gen<ClientInput>({ input: [ 0 ] });

function main() {
	let handler = uws(server);
	let socket = new wsw.Server(handler.handler);
	let tanks: { tank: Tank, input: ClientInput, key: wsw.Client }[] = [];
	const deltatime = 1000 / 20;

	socket.on.open.do(event => {
		tanks.push({
			tank: { name: "Unnamed", position: vec2.zero, velocity: vec2.zero, id: event.from },
			input: { input: [ 0, 0, 0, 0] },
			key: event.from
		});
	});

	socket.on.game(0x00).do(event => {
		let bpi = event.bpi(ClientIdentifyCodec);
	
		if (!bpi.valid)
			return;
			
		for (let tank of tanks) {
			if (tank.key === event.from) {
				tank.tank.name = bpi.input.name;
			}
		}
	});

	socket.on.game(0x01).do(event => {
		let bpi = event.bpi(ClientInputCodec);
		if (!bpi.valid || bpi.input.input.length > 4 || bpi.input.input.length === 0)
			return;

		let kkk = bpi.input.input.length - 1;
		for (let i = kkk; i < 4; ++i) {
			bpi.input.input[i] = bpi.input.input[kkk];
		}

		for (let tank of tanks) {
			if (tank.key === event.from) {
				tank.input = bpi.input;
			}
		}
	});

	socket.on.close.do(event => {
		for (let i = 0; i < tanks.length; i++) {
			if (tanks[i].key === event.from) {
				tanks.splice(i, 1);
				return;
			}
		}
	});

	new util.HighResolutionTimer(deltatime, timer => {
		for (let entity of tanks) {
			for (let i = 0; i < 4; ++i) {
				engine(entity.tank, deltatime, input(new ClientKeyboard(entity.input.input[i])));
			}
		}

		for (let tank of tanks) {
			let entity = tank;
			let players: Tank[] = [];
			for (let element of tanks) {
				if (element.key === entity.key)
					continue;
				players.push(element.tank);
			}

			let send = socket.app.serialize(StateUpdateCodec, 0x01, 0x01);
			send({ players: players, user: entity.tank }).where(entity.key);
		}

		function input(input: ClientKeyboard) {
			let result = vec2.zero;
			let force = 0.351;

			result.x -= input.left ? 1 : 0;
			result.x += input.right ? 1 : 0;
			result.y += input.up ? 1 : 0;
			result.y -= input.down ? 1 : 0;

			if (result.x === 0 && result.y === 0)
				return vec2.zero;
			
			return vec2.scale(force, vec2.normalize(result));
		}

		function engine(tank: Tank, deltatime: number, acc: vec2) {
			let dt = deltatime / 1000;
			let momentum = 0.93;

			tank.velocity = vec2.add(tank.velocity, vec2.scale(dt, acc));
			tank.position = vec2.add(tank.position, vec2.scale(dt, tank.velocity));
			tank.velocity = vec2.scale(momentum, tank.velocity);
		}
	}).run();
}

interface Tank {
	position: vec2;
	velocity: vec2;
	name: string;
	id: number;
}

interface StateUpdate {
	user: Tank;
	players: Tank[];
}

interface ClientIdentify {
	name: string;
}

interface ClientInput {
	input: number[];
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