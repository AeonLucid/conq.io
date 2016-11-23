namespace render {
	export type Graphics = CanvasRenderingContext2D;
	export type Window = HTMLCanvasElement;

	export class Viewport {
		constructor(public width: number, public height: number) { }

		public px(x: number): number {
			let invAspect = this.height / this.width;
			return (x * invAspect + 1) * this.width * 0.5;
		}

		public py(y: number): number {
			return (y + 1.0) * this.height * 0.5;
		}

		public sx(x: number): number {
			let invAspect = this.height / this.width;
			return x * this.width * invAspect * 0.5;
		}

		public sy(y: number): number {
			return y * this.height * 0.5;
		}

		public ix(x: number): number {
			let aspect = this.width / this.height;
			return aspect * (2.0 * x / this.width - 1);
		}

		public iy(y: number): number {
			return 2.0 * y / this.height - 1;
		}

		public get aspect(): number {
			return this.width / this.height;
		}
	}

	export class SimpleGraphics {
		private m_graphics: Graphics;
		private m_viewport: Viewport;
		private m_stroke: boolean = true;
		private m_fill: boolean = true;

		constructor(graphics: Graphics, viewport: Viewport) {
			this.m_graphics = graphics;
			this.m_viewport = viewport;
		}

		public get g(): Graphics {
			return this.m_graphics;
		}

		public stroke(value: string | boolean | number): SimpleGraphics {
			let g = this.m_graphics;

			if (typeof (value) === 'string') {
				g.strokeStyle = <string>value;
			} else if (typeof (value) === 'boolean') {
				this.m_stroke = <boolean>value;
			} else if (typeof (value) === 'number') {
				g.lineWidth = <number>value;
			}

			return this;
		}

		public fill(value: string | boolean): SimpleGraphics {
			let g = this.m_graphics;

			if (typeof (value) === 'string') {
				g.fillStyle = <string>value;
			} else {
				this.m_fill = <boolean>value;
			}

			return this;
		}

		public line(a: mvec.vec2, b: mvec.vec2): SimpleGraphics {
			let g = this.m_graphics;
			let v = this.m_viewport;

			if (this.m_stroke) {
				g.beginPath();
				g.moveTo(v.px(a.x), v.py(a.y));
				g.lineTo(v.px(b.x), v.py(b.y));
				g.stroke();
			}

			return this;
		}

		public pline(ax: number, ay: number, bx: number, by: number): SimpleGraphics {
			let g = this.m_graphics;
			let v = this.m_viewport;

			if (this.m_stroke) {
				g.beginPath();
				g.moveTo(v.px(ax), v.py(ay));
				g.lineTo(v.px(bx), v.py(by));
				g.stroke();
			}

			return this;
		}

		public rect(p: mvec.vec2, s: mvec.vec2) {
			let g = this.m_graphics;
			let v = this.m_viewport;

			if (this.m_fill) {
				g.fillRect(v.px(p.x), v.py(p.y), v.sx(s.x), v.sy(s.y));
			} if (this.m_stroke) {
				g.rect(v.px(p.x), v.py(p.y), v.sx(s.x), v.sy(s.y));
			}

			return this;
		}

		public prect(px: number, py: number, sx: number, sy: number) {
			let g = this.m_graphics;
			let v = this.m_viewport;

			if (this.m_fill) {
				g.fillRect(v.px(px), v.py(py), v.sx(sx), v.sy(sy));
			} if (this.m_stroke) {
				g.strokeRect(v.px(px), v.py(py), v.sx(sx), v.sy(sy));
			}

			return this;
		}

		public quad(a: mvec.vec2, b: mvec.vec2, c: mvec.vec2, d: mvec.vec2) {
			let v = this.m_viewport;

			this.impl_quad(v.px(a.x), v.py(a.y), v.px(b.x), v.py(b.y), v.px(c.x), v.py(c.y), v.px(d.x), v.py(d.y));
		}

		public pquad(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
			let v = this.m_viewport;

			this.impl_quad(v.px(ax), v.py(ay), v.px(bx), v.py(by), v.px(cx), v.py(cy), v.px(dx), v.py(dy));
		}

		public ellipse(p: mvec.vec2, ss: mvec.vec2 | number) {
			let v = this.m_viewport;
			let s = mvec.vec2.zero;

			if (typeof ss === "number") {
				s.x = <number>(ss);
				s.y = <number>(ss);
			} else {
				s = <mvec.vec2>(ss);
			}

			this.impl_ellipse(v.px(p.x), v.py(p.y), v.sx(s.x), v.sy(s.y));
		}

		public pellipse(px: number, py: number, sx: number, sy: number = sx) {
			let v = this.m_viewport;
			this.impl_ellipse(v.px(px), v.py(py), v.sx(sx), v.sy(sy));
		}

		private impl_triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
			let g = this.m_graphics;

			if (this.m_fill) {
				g.save();
				g.beginPath();

				g.moveTo(ax, ay);
				g.lineTo(bx, by);
				g.lineTo(cx, cy);

				g.restore();
				g.fill();
			} if (this.m_stroke) {
				g.save();
				g.beginPath();

				g.moveTo(ax, ay);
				g.lineTo(bx, by);
				g.lineTo(cx, cy);
				g.lineTo(ax, ay);

				g.restore();
				g.stroke();
			}
		}

		private impl_quad(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
			let g = this.m_graphics;

			if (this.m_fill) {
				g.save();
				g.beginPath();

				g.moveTo(ax, ay);
				g.lineTo(bx, by);
				g.lineTo(cx, cy);
				g.lineTo(dx, dy);

				g.restore();
				g.fill();
			} if (this.m_stroke) {
				g.save();
				g.beginPath();

				g.moveTo(ax, ay);
				g.lineTo(bx, by);
				g.lineTo(cx, cy);
				g.lineTo(dx, dy);
				g.lineTo(ax, ay);

				g.restore();
				g.stroke();
			}
		}

		private impl_ellipse(x: number, y: number, w: number, h: number) {
			let g = this.m_graphics;

			w /= 2;
			h /= 2;

			if (this.m_fill) {
				g.save();
				g.beginPath();

				g.translate(x, y);
				g.scale(w, h);
				g.arc(1, 1, 1, 0, 2 * Math.PI, false);

				g.restore();
				g.fill();
			} if (this.m_stroke) {
				g.save();
				g.beginPath();

				g.translate(x, y);
				g.scale(w, h);
				g.arc(1, 1, 1, 0, 2 * Math.PI, false);

				g.restore();
				g.stroke();
			}
		}
	}

	export abstract class BasicEngine {
		private m_firstRun: boolean = true;
		private m_lastRun: number;
		private m_fixedupdateAccumulator: number;
		private m_g: Graphics;
		private m_window: HTMLCanvasElement;
		private m_vp: Viewport;

		protected fixedupdateInterval: number = 1 / 30;

		constructor(g: Graphics, window: HTMLCanvasElement) {
			this.m_g = g;
			this.m_window = window;
			this.m_vp = new Viewport(window.width, window.height);
		}

		public updateViewport(): void {
			this.m_vp.width = this.m_window.width;
			this.m_vp.height = this.m_window.height;
		}

		public get vp() {
			return this.m_vp;
		}

		public run(): void {
			let time = new Date().getTime();

			if (this.m_firstRun) {
				this.m_firstRun = false;
				this.m_lastRun = time;
				this.m_fixedupdateAccumulator = 0;
				this.init(this.m_g, this.m_window);
				return;
			}

			let difference = time - this.m_lastRun;
			let fixedupdateIntervalMs = this.fixedupdateInterval * 1000;
			let fixedupdateOverflow = 0;
			this.m_lastRun = time;
			this.m_fixedupdateAccumulator += difference;

			this.update(difference / 1000.0, this.m_window);
			if (this.m_fixedupdateAccumulator > fixedupdateIntervalMs) {
				this.m_fixedupdateAccumulator = util.modulo(this.m_fixedupdateAccumulator, fixedupdateIntervalMs);
				this.fixedupdate(fixedupdateIntervalMs / 1000.0, this.m_window);
			}

			let sg = new SimpleGraphics(this.m_g, this.m_vp);
			this.m_g.save();
			this.m_g.translate(0, this.m_vp.height);
			this.m_g.scale(1, -1);
			this.render(sg, difference / 1000.0, this.m_window, this.m_vp);
			this.m_g.restore();
			this.rendertext(sg, difference / 1000.0, this.m_window, this.m_vp);
		}

		protected abstract init(g: Graphics, window: HTMLCanvasElement): void;
		protected abstract update(deltatime: number, window: HTMLCanvasElement): void;
		protected abstract fixedupdate(deltatime: number, window: HTMLCanvasElement): void;
		protected abstract render(sg: SimpleGraphics, deltatime: number, window: HTMLCanvasElement, vp: Viewport): void;
		protected abstract rendertext(sg: SimpleGraphics, deltatime: number, window: HTMLCanvasElement, vp: Viewport): void;
	}
}