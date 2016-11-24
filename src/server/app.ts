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

let StateUpdateCodec = bser.gen<StateUpdate>({
	user: { name: "", position: vec2.zero, velocity: vec2.zero, id: 0, angle: 0, health: 0 },
	players: [{ name: "", position: vec2.zero, velocity: vec2.zero, id: 0, angle: 0, health: 0 }], bullets: [{ id: 0, position: vec2.zero, velocity: vec2.zero }]
});

let ClientIdentifyCodec = bser.gen<ClientIdentify>({ name: "" });
let ClientInputCodec = bser.gen<ClientInput>({ input: [0], angle: 0, shoot: false });
let KillEventCodec = bser.gen<KillEvent>({ name: "" });
let DeadEventCodec = bser.gen<DeadEvent>({ by: "" });

function main() {
	let handler = uws(server);
	let socket = new wsw.Server(handler.handler);
	let tanks: { tank: Tank, input: ClientInput, key: wsw.Client, cooldown: number }[] = [];
	let bullets: { bullet: Bullet, time: number, by: wsw.Client }[] = [];
	let uniqueBulletId = 0;
	const deltatime = 1000 / 20;

	socket.on.open.do(event => {
		tanks.push({
			tank: { name: "Unnamed", position: new vec2(Math.random() * 5 - 2.5, Math.random() * 5 - 2.5), velocity: vec2.zero, id: event.from, angle: 0, health: 1 },
			input: { input: [0, 0, 0, 0], angle: 0, shoot: false },
			key: event.from,
			cooldown: 0
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

		let dead = false;
		for (let tank of tanks) {
			if (tank.tank.id === event.from) {
				if (tank.tank.health <= 0) {
					dead = true;
					break;
				}
			}
		}

		if (!dead) {
			let kkk = bpi.input.input.length - 1;
			for (let i = kkk; i < 4; ++i) {
				bpi.input.input[i] = bpi.input.input[kkk];
			}

			for (let tank of tanks) {
				if (tank.key === event.from) {
					tank.input = bpi.input;
					break;
				}
			}
		} else {
			for (let tank of tanks) {
				if (tank.key === event.from) {
					tank.input.input = [0, 0, 0, 0];
					tank.input.shoot = false;
					break;
				}
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
		for (let i = bullets.length - 1; i >= 0; i--) {
			if (bullets[i].time > 1)
				bullets.splice(i, 1);
		}

		for (let bullet of bullets) {
			bulletEngine(bullet, deltatime);
		}



		for (let entity of tanks) {
			let shot = false;
			let knockback = vec2.polar(entity.tank.angle + Math.PI, 0.6);
			entity.tank.angle = entity.input.angle;

			entity.cooldown -= deltatime / 1000;
			if (entity.input.shoot && entity.cooldown <= 0) {
				bullets.push({ bullet: { position: vec2.add(entity.tank.position, vec2.polar(entity.tank.angle, 0.2)), velocity: vec2.polar(entity.tank.angle, 2.4), id: uniqueBulletId++ }, time: 0, by: entity.key });
				entity.cooldown = 0.33;
				shot = true;
			}

			for (let i = 0; i < 4; ++i) {
				engine(entity.tank, deltatime, vec2.add(input(new ClientKeyboard(entity.input.input[i])), shot ? knockback : vec2.zero));
			}
		}

		let hit: wsw.Client[] = [];
		let hitBullet: { bullet: number, clientps: vec2 }[] = [];

		for (let entity of tanks) {
			for (let bullet of bullets) {
				let diff = vec2.subtract(entity.tank.position, bullet.bullet.position);
				if (vec2.magnitude(diff) <= 0.105) {
					hit.push(entity.tank.id);
					hitBullet.push({ bullet: bullet.bullet.id, clientps: entity.tank.position });
					let prevHealth = entity.tank.health;
					entity.tank.health -= 0.24;
					entity.tank.velocity = vec2.add(entity.tank.velocity, vec2.scale(0.15, bullet.bullet.velocity));
					
					
					if (entity.tank.health <= 0) {
						entity.tank.health = -1;
					
						if (prevHealth > 0) {	
							let killerBy = "Unknown";
							for (let killer of tanks) {
								if (killer.key === bullet.by) {
									killerBy = killer.tank.name;
									
									let send = socket.app.serialize(KillEventCodec, 0x01, 0x03);
									send({ name: entity.tank.name }).where(bullet.by);
								}
							}

							let send = socket.app.serialize(DeadEventCodec, 0x01, 0x02);
							send({ by: killerBy }).where(entity.key);

						}
					}
				}
			}
		}

		for (let i = bullets.length - 1; i >= 0; i--) {
			for (let j = 0; j < hitBullet.length; j++) {
				if (bullets[i].bullet.id === hitBullet[j].bullet) {
					bullets[i].bullet.velocity = vec2.zero;
					bullets[i].bullet.position = hitBullet[j].clientps;
					break;
				}
			}
		}


		let clientBullets: Bullet[] = [];
		for (let bullet of bullets) {
			clientBullets.push(bullet.bullet);
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
			send({ players: players, user: entity.tank, bullets: clientBullets }).where(entity.key);
		}

		for (let i = bullets.length - 1; i >= 0; i--) {
			for (let j = 0; j < hitBullet.length; j++) {
				if (bullets[i].bullet.id === hitBullet[j].bullet) {
					bullets.splice(i, 1);
					break;
				}
			}
		}

		function input(input: ClientKeyboard) {
			let result = vec2.zero;
			let force = 0.233;

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
			let momentum = 0.97;

			tank.velocity = vec2.add(tank.velocity, vec2.scale(dt, acc));
			tank.position = vec2.add(tank.position, vec2.scale(dt, tank.velocity));
			tank.velocity = vec2.scale(momentum, tank.velocity);

			if (tank.position.x < -3 + 0.08)
				tank.position.x = -3 + 0.08;
			else if (tank.position.x > 3 - 0.08)
				tank.position.x = 3 - 0.08;


			if (tank.position.y < -3 + 0.08)
				tank.position.y = -3 + 0.08;
			else if (tank.position.y > 3 - 0.08)
				tank.position.y = 3 - 0.08;
		}

		function bulletEngine(bullet: { bullet: Bullet, time: number }, deltatime: number) {
			let dt = deltatime / 1000;

			bullet.bullet.position = vec2.add(bullet.bullet.position, vec2.scale(dt, bullet.bullet.velocity));
			bullet.time += dt;
		}
	}).run();
}

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

interface KillEvent {
	name: string;
}

interface DeadEvent {
	by: string;
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