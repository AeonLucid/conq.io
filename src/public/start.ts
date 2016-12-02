namespace start {
    declare var FPSMeter;

    let canvas = (<HTMLCanvasElement>document.getElementById("canvas"));
    let g = (<CanvasRenderingContext2D>canvas.getContext("2d"));
    var meter = new FPSMeter({ theme: 'transparent', graph: 1, history: 16, show: 'fps', heat: 1 });

    const aspect = 16 / 9;
    let sg: gin.GraphicsInterface = new gin.GraphicsInterface(g, canvas.width, canvas.height, aspect);

    function grid() {
        let pivot = sg.pivot;

        sg.stroke.color(0x30, 0x30, 0x30);
        for (let y = -0.95; y < 1.04; y += 0.1)
            sg.draw.line([-1, y], [1, y]);

        for (let x = -0.95; x < 1.04; x += 0.1)
            sg.draw.line([x, -1], [x, 1]);

        sg.stroke.color(0x40, 0x40, 0x40);
        for (let y = -1; y < 1.01; y += 0.1)
            sg.draw.line([-1, y], [1, y]);

        for (let x = -1; x < 1.01; x += 0.1)
            sg.draw.line([x, -1], [x, 1]);

        sg.stroke.color(0x60, 0x60, 0x60);
        sg.draw.line([-1, 0], [1, 0]);
        sg.draw.line([0, -1], [0, 1]);

        sg.fill.color(0x60, 0x60, 0x60);
        sg.pivot = pivot.translate([0.95, 0]).scale(0.05);
        sg.draw.triangle([0, 0.5], [0, -0.5], [1, 0]);
        sg.pivot = pivot.translate([0, 0.95]).rotate(90).scale(0.05);
        sg.draw.triangle([0, 0.5], [0, -0.5], [1, 0]);
    }

    function draw() {
        sg.begin();
        sg.draw.clear([-aspect, -1], [aspect, 1]);
        grid();
        sg.begin();
    }

    export function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.scrollTop = 0;
        document.body.style.overflow = 'hidden';

        if (sg) {
            sg.resize(canvas.width, canvas.height, aspect);
            draw();
        }
    }

    function engine() {
        meter.tickStart();
        draw();
        meter.tick();

        requestAnimationFrame(engine);

    }

    resize();
    engine();
}

function resize() {
    start.resize();
}