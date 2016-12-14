namespace start {
    class ConcreteScene extends eng.Scene {
        public update(deltatime: number) {
            if (this.connected)
                this.switch(Concrete2Scene);
        }

        public render(g: eng.Graphics) {
            g.begin();
            g.draw.clear([-aspect, -1], [aspect, 1]);
            grid(g);
            g.begin();

            g.text.align("center").baseline("middle");
            g.text.font.family("Ubuntu").size(48);
            g.draw.text([0, 0], "Disconnected");
        }
    }

    class Concrete2Scene extends eng.Scene {
        public update(deltatime: number) {
            if (!this.connected)
                this.switch(ConcreteScene);
        }

        public render(g: eng.Graphics) {
            g.begin();
            g.draw.clear([-aspect, -1], [aspect, 1]);
            g.pivot = g.origin.rotate(45);
            grid(g);
            g.begin();

            g.text.align("center").baseline("middle");
            g.text.font.family("Ubuntu").size(48);
            g.draw.text([0, 0], "Connected");
        }
    }

    declare var FPSMeter;

    let canvas = (<HTMLCanvasElement>document.getElementById("canvas"));
    let meter = new FPSMeter({ theme: 'transparent', graph: 1, history: 16, show: 'fps', heat: 1 });

    const aspect = 16 / 9;
    let engine = new eng.SceneManager(ConcreteScene, canvas, "ws://localhost:3000/", aspect);

    function grid(g: eng.Graphics) {
        let pivot = g.pivot;

        g.stroke.color(0x30, 0x30, 0x30);
        for (let y = -0.95; y < 1.04; y += 0.1)
            g.draw.line([-1, y], [1, y]);

        for (let x = -0.95; x < 1.04; x += 0.1)
            g.draw.line([x, -1], [x, 1]);

        g.stroke.color(0x40, 0x40, 0x40);
        for (let y = -1; y < 1.01; y += 0.1)
            g.draw.line([-1, y], [1, y]);

        for (let x = -1; x < 1.01; x += 0.1)
            g.draw.line([x, -1], [x, 1]);

        g.stroke.color(0x60, 0x60, 0x60);
        g.draw.line([-1, 0], [1, 0]);
        g.draw.line([0, -1], [0, 1]);

        g.fill.color(0x60, 0x60, 0x60);
        g.pivot = pivot.translate([0.95, 0]).scale(0.05);
        g.draw.triangle([0, 0.5], [0, -0.5], [1, 0]);
        g.pivot = pivot.translate([0, 0.95]).rotate(90).scale(0.05);
        g.draw.triangle([0, 0.5], [0, -0.5], [1, 0]);
    }

    export function resize() {
        engine.resize();
    }

    function frame() {
        meter.tickStart();
        engine.run();
        meter.tick();
        requestAnimationFrame(frame);
    }

    frame();
}

function resize() {
    start.resize();
}