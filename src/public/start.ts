/// <reference path="../../node_modules/@types/jquery/index.d.ts"/>

let body: HTMLElement = document.body;
let engine: ConcreteEngine;

class ConcreteEngine extends render.BasicEngine {
	private m_keys: Set<number>;
	private m_socket: wsw.Socket;

	protected init(g: render.Graphics, window: render.Window): void {
		this.m_keys = new Set<number>();
		this.m_socket = new wsw.Socket("ws://localhost:3000");

		body.onkeydown = event => {
			this.m_keys.add(event.keyCode);
		}

		body.onkeyup = event => {
			this.m_keys.delete(event.keyCode);
		}
	}

	protected update(deltatime: number, window: render.Window): void { }
	protected fixedupdate(deltatime: number, window: render.Window): void { }
	protected render(sg: render.SimpleGraphics, deltatime: number, window: render.Window, vp: render.Viewport): void { }
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