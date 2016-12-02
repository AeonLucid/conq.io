namespace gin {
    type Graphics = util.Graphics;

    interface GraphicsAttribute {
        showStroke: boolean;
        showFill: boolean;
    }

    function componentToHex(c: number) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(red: number, green: number, blue: number) {
        return "#" + componentToHex(red) + componentToHex(green) + componentToHex(blue);
    }

    class TransformFrame {
        public pivot: Transform;
        public width: number;
        public height: number;
        public target: number;

        constructor(pivot: Transform, width: number, height: number, target: number) {
            this.pivot = pivot;
            this.width = width;
            this.height = height;
            this.target = target;
        }

        private postTransform(v: vec2) {
            let x = (v.x + 1.0) * 0.5 * this.width;
            let y = (1.0 - (v.y + 1.0) * 0.5) * this.height;

            return new vec2(x | 0, y | 0);
        }

        private aspectTransform(v: vec2) {
            let a = this.width / this.height;
            let u = this.target;

            let x = v.x;
            let y = v.y;

            if (a > u) {
                y *= a / u;
            } else {
                x *= u / a;
            }

            if (u >= 1) {
                x /= u;
            } else {
                y *= u;
            }

            return new vec2(x, y);
        }

        private pivotTransform(v: vec2) {
            return this.pivot.transform(v);
        }

        public transform(v: vec2) {
            return this.postTransform(this.aspectTransform(this.pivotTransform(v)));
        }
    }

    class FillProperty {
        private m_g: Graphics;
        private m_attribute: GraphicsAttribute;

        constructor(g: Graphics, attribute: GraphicsAttribute) {
            this.m_g = g;
            this.m_attribute = attribute;
        }

        public color(red: number, green: number, blue: number) {
            let g = this.m_g;
            g.fillStyle = rgbToHex(red, green, blue);
            return this;
        }

        public visible(value: boolean) {
            this.m_attribute.showFill = value;
            return this;
        }

        public opacity(value: number) {
            return this;
        }
    }

    class StrokeProperty {
        private m_g: Graphics;
        private m_attribute: GraphicsAttribute;

        constructor(g: Graphics, attribute: GraphicsAttribute) {
            this.m_g = g;
            this.m_attribute = attribute;
        }

        public color(red: number, green: number, blue: number) {
            let g = this.m_g;
            g.strokeStyle = rgbToHex(red, green, blue);
            return this;
        }

        public visible(value: boolean) {
            this.m_attribute.showStroke = value;
            return this;
        }

        public opacity(value: number) {
            return this;
        }

        public thickness(value: number) {
            let g = this.m_g;
            g.lineWidth = value;
            return this;
        }
    }

    class DrawInterface {
        private m_g: Graphics;
        private m_transform: TransformFrame;
        private m_attribute: GraphicsAttribute;

        constructor(g: Graphics, transform: TransformFrame, attribute: GraphicsAttribute) {
            this.m_g = g;
            this.m_transform = transform;
            this.m_attribute = attribute;
        }

        public circle(position: mvec2, radius: number) {
            if (!(this.showStroke || this.showFill))
                return this;

            let p = this.transform(position);
            let g = this.m_g;
            let r = vec2.length(vec2.subtract(this.transform(vec2.add(vec2.convert(position), new vec2(radius, 0))), p));

            g.beginPath();
            g.arc(p.x, p.y, r, 0, Math.PI * 2, false);

            if (this.showFill)
                g.fill();
            if (this.showStroke)
                g.stroke();

            return this;
        }

        public clear(a: mvec2, b: mvec2) {
            let pa = this.transform(a);
            let pb = this.transform(b);
            let s = vec2.subtract(pb, pa);
            let g = this.m_g;

            g.clearRect(pa.x, pa.y, s.x, s.y);

            return this;
        }

        public rectangle(a: mvec2, b: mvec2) {
            let pa = this.transform(a);
            let pb = this.transform(b);
            let s = vec2.subtract(pb, pa);
            let g = this.m_g;

            if (this.showFill)
                g.fillRect(pa.x, pa.y, s.x, s.y);
            if (this.showStroke)
                g.strokeRect(pa.x, pa.y, s.x, s.y);

            return this;
        }

        public line(a: mvec2, b: mvec2) {
            if (!this.showStroke)
                return this;

            let pa = this.transform(a);
            let pb = this.transform(b);
            let g = this.m_g;

            g.beginPath();
            g.moveTo(pa.x, pa.y);
            g.lineTo(pb.x, pb.y);
            g.stroke();

            return this;
        }

        public triangle(a: mvec2, b: mvec2, c: mvec2) {
            if (!(this.showStroke || this.showFill))
                return this;

            let pa = this.transform(a);
            let pb = this.transform(b);
            let pc = this.transform(c);
            let g = this.m_g;

            g.beginPath();
            g.moveTo(pa.x, pa.y);
            g.lineTo(pb.x, pb.y);
            g.lineTo(pc.x, pc.y);
            g.lineTo(pa.x, pa.y);

            if (this.showFill)
                g.fill();
            if (this.showStroke)
                g.stroke();

            return this;
        }

        public quad(a: mvec2, b: mvec2, c: mvec2, d: mvec2) {
            let pa = this.transform(a);
            let pb = this.transform(b);
            let pc = this.transform(c);
            let pd = this.transform(d);
            let g = this.m_g;

            g.beginPath();
            g.moveTo(pa.x, pa.y);
            g.lineTo(pb.x, pb.y);
            g.lineTo(pc.x, pc.y);
            g.lineTo(pd.x, pd.y);
            g.lineTo(pa.x, pa.y);

            if (this.showFill)
                g.fill();
            if (this.showStroke)
                g.stroke();

            return this;
        }

        public polygon(a: mvec2, b: mvec2, c: mvec2, ...more: mvec2[]) {
            let pp: vec2[] = [];
            pp.push(this.transform(a));
            pp.push(this.transform(b));
            pp.push(this.transform(c));
            for (let v of more)
                pp.push(this.transform(v));
            let g = this.m_g;

            g.beginPath();
            let origin = pp.pop() !;
            g.moveTo(origin.x, origin.y);
            for (let p of pp)
                g.lineTo(p.x, p.y);
            g.lineTo(origin.x, origin.y);

            if (this.showFill)
                g.fill();
            if (this.showStroke)
                g.stroke();

            return this;
        }

        private transform(v: mvec2) {
            return this.m_transform.transform(vec2.convert(v));
        }

        private get showStroke() {
            return this.m_attribute.showStroke;
        }

        private get showFill() {
            return this.m_attribute.showFill;
        }
    }

    export class GraphicsInterface {
        private m_stroke: StrokeProperty;
        private m_fill: FillProperty;
        private m_draw: DrawInterface;
        private m_transform: TransformFrame;
        private m_g: Graphics;
        private m_attribute: GraphicsAttribute;

        constructor(g: Graphics, width: number, height: number, target: number) {
            this.m_g = g;

            this.m_attribute = { showFill: true, showStroke: true };
            this.m_transform = new TransformFrame(this.origin, width, height, target);
            this.m_fill = new FillProperty(g, this.m_attribute);
            this.m_stroke = new StrokeProperty(g, this.m_attribute);
            this.m_draw = new DrawInterface(g, this.m_transform, this.m_attribute);
            this.begin();
        }

        public get origin() {
            return new Transform();
        }

        public get stroke() {
            return this.m_stroke;
        }

        public get fill() {
            return this.m_fill;
        }

        public get draw() {
            return this.m_draw;
        }

        public get pivot() {
            return this.m_transform.pivot;
        }

        public set pivot(pivot: Transform) {
            this.m_transform.pivot = pivot;
        }

        public resize(width: number, height: number, target: number) {
            this.m_transform.width = width;
            this.m_transform.height = height;
            this.m_transform.target = target;
        }

        public begin() {
            this.pivot = this.origin;
            this.fill.visible(true).color(0xFF, 0xFF, 0xFF).opacity(1);
            this.stroke.visible(true).color(0xFF, 0xFF, 0xFF).opacity(1).thickness(1);
        }
    }

    export class Transform {
        private m_translate: vec2;
        private m_rotate: number;
        private m_scale: number;

        private m_x: vec2;
        private m_y: vec2;

        constructor(translate: mvec2 = [0, 0], rotate: number = 0, scale: number = 1) {
            this.m_translate = vec2.convert(translate);
            this.m_rotate = util.wrapAngle(rotate);
            this.m_scale = scale;

            this.m_x = new vec2(Math.cos(rotate) * scale, -Math.sin(rotate) * scale);
            this.m_y = new vec2(Math.sin(rotate) * scale, Math.cos(rotate) * scale);
        }

        public transform(v: mvec2) {
            let vv = vec2.convert(v);
            return vec2.add(this.m_translate, vec2.add(vec2.scale(vv.x, this.m_x), vec2.scale(vv.y, this.m_y)));
        }

        public translate(v: mvec2) {
            return new Transform(this.transform(vec2.convert(v)), this.m_rotate, this.m_scale);
        }

        public rotate(s: number) {
            return new Transform(this.m_translate, util.wrapAngle(this.m_rotate + util.radians(-s)), this.m_scale);
        }

        public scale(s: number) {
            return new Transform(this.m_translate, this.m_rotate, this.m_scale * s);
        }
    }

    export class vec2 {
        public x: number;
        public y: number;

        constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
        }

        public static add(lhs: vec2, rhs: vec2) {
            return new vec2(lhs.x + rhs.x, lhs.y + rhs.y);
        }

        public static subtract(lhs: vec2, rhs: vec2) {
            return new vec2(lhs.x - rhs.x, lhs.y - rhs.y);
        }

        public static scale(scalar: number, v: vec2) {
            return new vec2(scalar * v.x, scalar * v.y);
        }

        public static dot(lhs: vec2, rhs: vec2) {
            return lhs.x * rhs.x + lhs.y * rhs.y;
        }

        public static cross(lhs: vec2, rhs: vec2) {
            return lhs.x * rhs.y - lhs.y * rhs.x;
        }

        public static length2(v: vec2) {
            return v.x * v.x + v.y * v.y;
        }

        public static length(v: vec2) {
            return Math.sqrt(v.x * v.x + v.y * v.y);
        }

        public static normalize(v: vec2) {
            let s = 1.0 / Math.sqrt(v.x * v.x + v.y * v.y);
            return new vec2(s * v.x, s * v.y);
        }

        public static project(v: vec2, onto: vec2) {
            return vec2.scale(vec2.dot(v, vec2.normalize(onto)), onto);
        }

        public static reject(v: vec2, onto: vec2) {
            return vec2.subtract(v, vec2.project(v, onto));
        }

        public static get zero() {
            return new vec2(0, 0);
        }

        public static get x() {
            return new vec2(1, 0);
        }

        public static get y() {
            return new vec2(0, 1);
        }

        public static copy(v: vec2): vec2 {
            return new vec2(v.x, v.y);
        }

        public static convert(v: mvec2): vec2 {
            if (v instanceof Array) {
                let va = <number[]>v;
                let x = 0;
                let y = 0;
                if (va.length > 0) {
                    x = va[0];
                } if (va.length > 1) {
                    y = va[1];
                }
                return new vec2(x, y);
            } else {
                let vi = <vec2>v;
                return new vec2(vi.x, vi.y);
            }
        }
    }

    export type mvec2 = vec2 | number[];
}