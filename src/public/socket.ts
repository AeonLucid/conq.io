namespace wsw {
    export type Binary = ArrayBuffer;
    export let padding = 2;
    
    type StateListener = (packet: StatePacket) => void;
    type PacketListener = (packet: DataPacket) => void;
    type BasicPacketIOBuilder = <Input, Output>(inputCodec: bser.Codec<Input>, outputCodec: bser.Codec<Output>)
        => BasicPacketIO<Input, Output>;
    type BasicPacketInputBuilder = <Input>(inputCodec: bser.Codec<Input>) => BasicPacketInput<Input>;

    interface DataPacket {
        raw: Binary;
        bpio: BasicPacketIOBuilder;
        bpi: BasicPacketInputBuilder;
        app: Application;
    }

    interface StatePacket {
        app: Application;
    }

    class BasicPacketIO<Input, Output> {
        private m_app: Application;
        private m_outputCodec: bser.Codec<Output>;
        private m_input: Input | undefined;
        private m_raw: Binary;

        constructor(app: Application, raw: Binary, inputCodec: bser.Codec<Input>, outputCodec: bser.Codec<Output>) {
            this.m_app = app;
            this.m_outputCodec = outputCodec;
            this.m_raw = raw;
            this.m_input = inputCodec.decode(raw, padding);
        }

        public get valid() {
            return this.m_input !== undefined;
        }

        public get input(): Input {
            if (!this.valid)
                throw new Error("Given packet is not valid");
            return this.m_input!;
        }

        public send(output: Output) {
            let outputBinary = this.m_outputCodec.encode(output, padding);
            this.m_app.send(outputBinary);
        }
    }

    class BasicPacketInput<Input> {
        private m_app: Application;
        private m_input: Input | undefined;
        private m_raw: Binary;

        constructor(app: Application, raw: Binary, inputCodec: bser.Codec<Input>) {
            this.m_app = app;
            this.m_raw = raw;
            this.m_input = inputCodec.decode(raw, padding);
        }

        public get valid() {
            return this.m_input !== undefined;
        }

        public get input(): Input {
            if (!this.valid)
                throw new Error("Given packet is not valid");
            return this.m_input!;
        }
    }

    function genBasicPacketIOBuilder(app: Application, raw: Binary): BasicPacketIOBuilder {
        return function builder<Input, Output>
            (inputCodec: bser.Codec<Input>, outputCodec: bser.Codec<Output>): BasicPacketIO<Input, Output> {
            
            return new BasicPacketIO<Input, Output>(app, raw, inputCodec, outputCodec);
        }
    }

    function genBasicPacketInputBuilder(app: Application, raw: Binary): BasicPacketInputBuilder {
        return function builder<Input>
            (inputCodec: bser.Codec<Input>): BasicPacketInput<Input> {
            
            return new BasicPacketInput<Input>(app, raw, inputCodec);
        }
    }


    interface ResolverManagerObject {
        main: number;
        sub: number;
        receiver: PacketListener;
    }

    class ResolverManager {
        private m_resolvers: ResolverManagerObject[];

        constructor() {
            this.m_resolvers = [];
        }

        public set(main: number, sub: number, receiver: PacketListener) {
            for (let resolver of this.m_resolvers) {
                if (resolver.main === main && resolver.sub === sub) {
                    resolver.receiver = receiver;
                    return;
                }
            }

            this.m_resolvers.push({ main: main, sub: sub, receiver: receiver });
        }

        public unset(main: number, sub: number) {
            for (let i = 0; i < this.m_resolvers.length; i++) {
                let resolver = this.m_resolvers[i];

                if (resolver.main === main && resolver.sub === sub) {
                    this.m_resolvers.splice(i, 1);
                    return;
                }
            }
        }

        public call(main: number, sub: number, packet: DataPacket) {
            for (let resolver of this.m_resolvers) {
                if (resolver.main === main && resolver.sub === sub) {
                    resolver.receiver(packet);
                }
            }
        }
    }

    interface ResolverStateWrapper {
        listener: StateListener;
    }

    class ResolverStateBinder {
        private m_stateListener: ResolverStateWrapper;

        constructor(stateListener: ResolverStateWrapper) {
            this.m_stateListener = stateListener;
        }

        public do(callback: StateListener) {
            this.m_stateListener.listener = callback;
        }

        public ignore() {
            this.m_stateListener.listener = () => { };
        }
    }

    class ResolverBinder {
        private m_manager: ResolverManager;
        private m_main: number;
        private m_subs: number[];

        constructor(manager: ResolverManager, main: number, subs: number[]) {
            this.m_manager = manager;
            this.m_main = main;
            this.m_subs = subs;
        }

        public do(callback: PacketListener) {
            for (let sub of this.m_subs) {
                this.m_manager.set(this.m_main, sub, callback);
            }
        }

        public ignore() {
            for (let sub of this.m_subs) {
                this.m_manager.unset(this.m_main, sub);
            }
        }
    }

    class ResolverProperty {
        private m_manager: ResolverManager;
        private m_openListener: ResolverStateWrapper;
        private m_closeListener: ResolverStateWrapper;

        constructor(manager: ResolverManager, openListener: ResolverStateWrapper, closeListener: ResolverStateWrapper) {
            this.m_manager = manager;
            this.m_openListener = openListener;
            this.m_closeListener = closeListener;
        }

        public system(sub: number | number[]) {
            return new ResolverBinder(this.m_manager, 0x00, this.subArray(sub));
        }

        public game(sub: number | number[]) {
            return new ResolverBinder(this.m_manager, 0x01, this.subArray(sub));
        }

        public debug(sub: number | number[]) {
            return new ResolverBinder(this.m_manager, 0x02, this.subArray(sub));
        }

        public get open() {
            return new ResolverStateBinder(this.m_openListener);
        }

        public get close() {
            return new ResolverStateBinder(this.m_closeListener);
        }

        private subArray(raw: number | number[]) {
            if (raw instanceof Array) {
                return <number[]>raw;
            } else {
                return [<number>raw];
            }
        }
    }

    class Application {
        private m_socket: WebSocket;

        constructor(socket: WebSocket) {
            this.m_socket = socket;
        }

        public send(data: Binary) {
            this.m_socket.send(data);
        }
    }

    export class Socket {
        private m_socket: WebSocket;
        private m_resolverManager: ResolverManager;
        private m_open: boolean = false;
        private m_openListener: ResolverStateWrapper;
        private m_closeListener: ResolverStateWrapper;
        private m_app: Application;

        constructor(url: string) {
            this.m_resolverManager = new ResolverManager();
            this.m_socket = new WebSocket(url);
            this.m_socket.binaryType = "arraybuffer";
            this.m_openListener = { listener: () => { } };
            this.m_closeListener = { listener: () => { } };
            this.m_app = new Application(this.m_socket);

            this.m_socket.onmessage = event => {
                let data = <ArrayBuffer>event.data;
                let view = new DataView(data);
                let header = view.getUint16(0);

                let main = (header & 0xF000) >> 12;
                let sub = header & 0x0FFF;
                this.m_resolverManager.call(main, sub, {
                    app: this.m_app,
                    bpi: genBasicPacketInputBuilder(this.m_app, data),
                    bpio: genBasicPacketIOBuilder(this.m_app, data), 
                    raw: data 
                });
            }

            this.m_socket.onopen = () => {
                this.m_open = true;
                this.m_openListener.listener({ app: this.m_app });
            }

            this.m_socket.onclose = () => {
                this.m_open = false;
                this.m_closeListener.listener({ app: this.m_app });
            }
        }

        public get on() {
            return new ResolverProperty(this.m_resolverManager,
                this.m_openListener, this.m_closeListener);
        }
    }
}