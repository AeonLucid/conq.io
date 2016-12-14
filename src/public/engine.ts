namespace eng {
	export type Window = HTMLCanvasElement;
	export type Graphics = gin.GraphicsInterface;
    export type SceneConstructor = { new(int: SceneInterface): Scene };

    function inverseTransform(p: gin.vec2, w: number, h: number, u: number) {
        let a = w / h;

        let s = p.x / w * 2.0 - 1.0;
        let t = p.y / h * 2.0 - 1.0;

        if (u >= 1)
            s *= u;
        else
            t /= u;
        
        if (a <= u)
            s *= a / u;
        else
            t *= u / a;

        return new gin.vec2(s, t);
    }

    interface SceneInterface {
        socket: wsw.Socket;
        window: Window;
        switcher: (scene: SceneConstructor) => void;
        input: InputStructure;
    }

    interface InputStructure {
        keys: boolean[];
        leftMouse: boolean;
        middleMouse: boolean;
        rightMouse: boolean;
        positionMouse: gin.vec2;
    }

    class MouseProperty {
        private m_input: InputStructure;

        constructor(input: InputStructure) {
            this.m_input = input;
        }

        public get left() {
            return this.m_input.leftMouse;
        }

        public get middle() {
            return this.m_input.middleMouse;
        }

        public get right() {
            return this.m_input.rightMouse;
        }

        public get position() {
            return this.m_input.positionMouse;
        }
    }

    class InputInterface {
        private m_input: InputStructure;
        private m_mouse: MouseProperty;
        
        constructor(input: InputStructure) {
            this.m_input = input;
            this.m_mouse = new MouseProperty(input);
        }

        public key(key: number) {
            return this.m_input.keys[key];
        }

        public get mouse() {
            return this.m_mouse;
        }
    }

    class SocketWrapper {
        private m_socket: wsw.Socket;

        constructor(socket: wsw.Socket) {
            this.m_socket = socket;
        }

        public get app() {
            return this.m_socket.app;
        }

        public get on() {
            return this.m_socket.on;
        }
    }

    export abstract class Scene {
        private m_int: SceneInterface;
        private m_socket: SocketWrapper;
        private m_input: InputInterface;

        constructor(int: SceneInterface) {
            this.m_int = int;
            this.m_socket = new SocketWrapper(int.socket);
            this.m_input = new InputInterface(int.input);
        }

        protected get socket() {
            return this.m_socket;
        }

        protected get window() {
            return this.m_int.window;
        }

        protected get connected() {
            return this.m_int.socket.sys.connected;
        }

        protected get input() {
            return this.m_input;
        }

        protected switch(scene: SceneConstructor) {
            this.m_int.switcher(scene);
        }
    
        public abstract update(deltatime: number);
        public abstract render(g: Graphics);
    }

    export class SceneManager {
        private m_url: string;
        private m_socket: wsw.Socket;
        private m_window: Window;
        private m_g: Graphics;
        private m_scene: Scene;
        private m_target: number;
        private m_nextScene: SceneConstructor | undefined;
        private m_prefRun: number;
        private m_inputStructure: InputStructure;

        constructor(scene: SceneConstructor, window: Window, url: string, target: number) {
            this.m_url = url;
            this.m_socket = new wsw.Socket();
            this.m_window = window;
            this.m_target = target;
            this.m_nextScene = undefined;
            this.m_scene = this.buildScene(scene);
            this.m_prefRun = performance.now();
            this.m_inputStructure = {
                keys: [],
                leftMouse: false,
                middleMouse: false,
                rightMouse: false,
                positionMouse: gin.vec2.zero 
            };

            document.onkeydown = event => {
                this.m_inputStructure.keys[event.keyCode] = true;
            }

            document.onkeyup = event => {
                this.m_inputStructure.keys[event.keyCode] = false;
            }

            document.onmousemove = event => {
                this.m_inputStructure.positionMouse = inverseTransform(
                    new gin.vec2(event.clientX, event.clientY),
                    this.m_window.width,
                    this.m_window.height,
                    this.m_target
                );
            }

            document.onmousedown = event => {
                if (event.which === 1)
                    this.m_inputStructure.leftMouse = true;
                else if (event.which === 2)
                    this.m_inputStructure.middleMouse = true;
                else if (event.which === 3)
                    this.m_inputStructure.rightMouse = true;
            }

            document.onmouseup = event => {
                if (event.which === 1)
                    this.m_inputStructure.leftMouse = false;
                else if (event.which === 2)
                    this.m_inputStructure.middleMouse = false;
                else if (event.which === 3)
                    this.m_inputStructure.rightMouse = false;
            }

            let ctx = (<CanvasRenderingContext2D>window.getContext("2d"));
            this.m_g = new gin.GraphicsInterface(ctx, window.width, window.height, target);
            this.resize();
        }

        public run() {
            if (!this.m_socket.sys.connected)
                this.m_socket.sys.open(this.m_url);

            let time = performance.now();
            let deltatime = time - this.m_prefRun;
            this.m_scene.update(deltatime * 0.001);
            this.m_prefRun = time;

            if (this.m_nextScene) {
                this.m_scene = this.buildScene(this.m_nextScene);
                this.m_nextScene = undefined;
                return;
            }

            this.m_g.begin();
            this.m_scene.render(this.m_g);
        }

        public resize() {
            this.m_window.width = window.innerWidth;
            this.m_window.height = window.innerHeight;
            document.body.scrollTop = 0;
            document.body.style.overflow = 'hidden';

			this.m_g.resize(this.m_window.width, this.m_window.height, this.m_target);
			this.m_g.begin();
			this.m_scene.render(this.m_g);
        }

        private switcher(scene: SceneConstructor) {
            this.m_nextScene = scene;
        }

        private buildScene(scene: SceneConstructor) {
            return new scene({
                socket: this.m_socket,
                switcher: this.switcher.bind(this),
                window: this.m_window,
                input: this.m_inputStructure 
            });
        }
    }
}